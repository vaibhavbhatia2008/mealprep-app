import { Router, type IRouter } from "express";
import { ImportRecipeFromUrlBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

interface SchemaRecipe {
  "@type"?: string | string[];
  name?: string;
  recipeIngredient?: string[];
  recipeInstructions?: unknown;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  nutrition?: { calories?: string };
}

function parseIso8601Duration(duration?: string): number | null {
  if (!duration) return null;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!match) return null;
  const hours = parseInt(match[1] ?? "0");
  const minutes = parseInt(match[2] ?? "0");
  return hours * 60 + minutes || null;
}

function extractInstructions(instructions: unknown): string {
  if (typeof instructions === "string") return instructions.trim();
  if (Array.isArray(instructions)) {
    return instructions
      .map((step: unknown) => {
        if (typeof step === "string") return step.trim();
        if (step && typeof step === "object" && "text" in step) {
          return String((step as Record<string, unknown>).text).trim();
        }
        return "";
      })
      .filter(Boolean)
      .join("\n\n");
  }
  return "";
}

function tryParseJsonLd(html: string): SchemaRecipe | null {
  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const raw = JSON.parse(match[1]);
      const candidates: unknown[] = Array.isArray(raw) ? raw : [raw];

      for (const item of candidates) {
        if (!item || typeof item !== "object") continue;
        const obj = item as Record<string, unknown>;

        // Direct @type: Recipe
        if (obj["@type"] === "Recipe" || (Array.isArray(obj["@type"]) && (obj["@type"] as string[]).includes("Recipe"))) {
          return obj as SchemaRecipe;
        }

        // @graph array
        if (Array.isArray(obj["@graph"])) {
          for (const node of obj["@graph"] as unknown[]) {
            if (node && typeof node === "object") {
              const n = node as Record<string, unknown>;
              if (n["@type"] === "Recipe" || (Array.isArray(n["@type"]) && (n["@type"] as string[]).includes("Recipe"))) {
                return n as SchemaRecipe;
              }
            }
          }
        }
      }
    } catch {
      // continue to next script tag
    }
  }
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{3,}/g, "\n")
    .trim()
    .slice(0, 8000);
}

router.post("/recipes/import-url", requireAuth, async (req, res): Promise<void> => {
  const parsed = ImportRecipeFromUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request: url is required" });
    return;
  }

  const { url } = parsed.data;

  let html: string;
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PrepSmart/1.0; recipe-importer)",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      res.status(422).json({ error: `Could not fetch URL (HTTP ${response.status})` });
      return;
    }
    html = await response.text();
  } catch (err) {
    res.status(422).json({ error: "Failed to fetch the URL. Make sure it is publicly accessible." });
    return;
  }

  // Strategy 1: JSON-LD structured data
  const schemaRecipe = tryParseJsonLd(html);
  if (schemaRecipe) {
    const ingredients = (schemaRecipe.recipeIngredient ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean);
    const instructions = extractInstructions(schemaRecipe.recipeInstructions);
    const prepTime = parseIso8601Duration(schemaRecipe.prepTime ?? schemaRecipe.totalTime);
    const caloriesStr = schemaRecipe.nutrition?.calories;
    const calories = caloriesStr ? parseInt(caloriesStr.replace(/\D.*/, "")) || null : null;

    res.json({
      name: schemaRecipe.name?.trim() ?? "Imported Recipe",
      ingredients,
      instructions: instructions || "No instructions found",
      prepTime,
      calories,
      sourceUrl: url,
    });
    return;
  }

  // Strategy 2: AI extraction from page text
  const pageText = stripHtml(html);
  if (!pageText.trim()) {
    res.status(422).json({ error: "Could not extract content from the page" });
    return;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 2048,
      messages: [
        {
          role: "system",
          content:
            "You are a recipe parser. Extract recipe information from webpage text. Return ONLY valid JSON with no markdown fences, comments, or extra text. The JSON must match this schema exactly: { name: string, ingredients: string[], instructions: string, prepTime: number | null, calories: number | null }. For ingredients, use lowercase simple strings like 'olive oil' or '2 cups flour'. For instructions, write clear step-by-step text. prepTime is in minutes as an integer or null. calories is per serving as an integer or null.",
        },
        {
          role: "user",
          content: `Extract the recipe from this webpage text:\n\n${pageText}`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    let extracted: { name: string; ingredients: string[]; instructions: string; prepTime: number | null; calories: number | null };

    try {
      extracted = JSON.parse(content);
    } catch {
      res.status(422).json({ error: "Could not parse recipe from this page. Try a different URL." });
      return;
    }

    if (!extracted.name || !Array.isArray(extracted.ingredients)) {
      res.status(422).json({ error: "Could not extract a valid recipe from this page." });
      return;
    }

    res.json({
      name: extracted.name,
      ingredients: extracted.ingredients.map((s) => String(s).toLowerCase().trim()).filter(Boolean),
      instructions: extracted.instructions || "",
      prepTime: typeof extracted.prepTime === "number" ? extracted.prepTime : null,
      calories: typeof extracted.calories === "number" ? extracted.calories : null,
      sourceUrl: url,
    });
  } catch (err) {
    res.status(422).json({ error: "Could not extract recipe from this page. Please enter details manually." });
  }
});

export default router;

import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import React, { createContext, useContext, useEffect, useState } from "react";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
}

const TOKEN_KEY = "prepsmart_token";
const USER_KEY = "prepsmart_user";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setAuthTokenGetter(() => AsyncStorage.getItem(TOKEN_KEY));

    Promise.all([
      AsyncStorage.getItem(TOKEN_KEY),
      AsyncStorage.getItem(USER_KEY),
    ]).then(([storedToken, storedUser]) => {
      if (storedToken) setToken(storedToken);
      if (storedUser) {
        try {
          setUserState(JSON.parse(storedUser));
        } catch {}
      }
      setIsLoading(false);
    });

    return () => {
      setAuthTokenGetter(null);
    };
  }, []);

  const login = async (newToken: string, newUser: AuthUser) => {
    await AsyncStorage.setItem(TOKEN_KEY, newToken);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUserState(newUser);
  };

  const logout = async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
    setToken(null);
    setUserState(null);
  };

  const setUser = (u: AuthUser) => setUserState(u);

  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

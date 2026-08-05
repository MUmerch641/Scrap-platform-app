import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Role } from '@/shared/roles';

export interface UserProfile {
  userId: string;
  email: string;
  role: Role;
}

interface UserRoleContextProps {
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile | null) => void;
  signOut: () => void;
}

const UserRoleContext = createContext<UserRoleContextProps | undefined>(undefined);

export const UserRoleProvider = ({ children }: { children: ReactNode }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const signOut = () => {
    setUserProfile(null);
  };

  return (
    <UserRoleContext.Provider value={{ userProfile, setUserProfile, signOut }}>
      {children}
    </UserRoleContext.Provider>
  );
};

export const useUserRole = () => {
  const context = useContext(UserRoleContext);
  if (!context) {
    throw new Error('useUserRole must be used within a UserRoleProvider');
  }
  return context;
};


"use client";

import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const router = useRouter();

  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem',
      borderBottom: '1px solid #e5e7eb',
      backgroundColor: 'white'
    }}>
        Conjure
      <div>
        {isAuthenticated ? (
          <button
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              cursor: 'pointer'
            }}
            onClick={() =>
              void signOut().then(() => {
                router.push("/signin");
              })
            }
          >
            Sign out
          </button>
        ) : (
          <button
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: '1px solid #007bff',
              borderRadius: '0.375rem',
              cursor: 'pointer'
            }}
            onClick={() => router.push("/signin")}
          >
            Sign in
          </button>
        )}
      </div>
    </nav>
  );
} 
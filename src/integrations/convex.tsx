"use client";

import { Auth0Provider } from "@auth0/nextjs-auth0";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithAuth0 } from "convex/react-auth0";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function ConvexAndAuth0Integration({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Auth0Provider>
      <ConvexProviderWithAuth0 client={convex}>
        {children}
      </ConvexProviderWithAuth0>
    </Auth0Provider>
  );
}

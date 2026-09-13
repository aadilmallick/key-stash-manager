import React from "react";

export const ClerkProvider = React.lazy(() =>
    import("@clerk/react").then((module) => ({
        default: module.ClerkProvider,
    }))
);

export const PricingTable = React.lazy(() =>
    import("@clerk/react").then((module) => ({
        default: module.PricingTable,
    }))
);

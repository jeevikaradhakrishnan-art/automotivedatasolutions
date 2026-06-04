import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/solutions/")({ component: () => <Navigate to="/" /> });

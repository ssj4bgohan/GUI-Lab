import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/chat" });
  },
  component: () => null,
  head: () => ({
    meta: [
      { title: "." },
      {
        name: "description",
        content:
          ".",
      },
      {
        property: "og:title",
        content: ".",
      },
      {
        property: "og:description",
        content: ".",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),

});

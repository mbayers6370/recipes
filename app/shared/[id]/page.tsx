import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { SharedRecipeClient } from "./shared-recipe-client";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

async function getSharedRecipe(id: string) {
  return prisma.recipe.findFirst({
    where: {
      id,
      isPublic: true,
    },
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      user: {
        select: {
          username: true,
          displayName: true,
        },
      },
    },
  });
}

function resolveSocialImage(imageUrl?: string | null) {
  if (!imageUrl) {
    return `${appUrl}/sharing_image.png`;
  }

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  return `${appUrl}${imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const recipe = await getSharedRecipe(id);

  if (!recipe) {
    return {
      title: "Recipe not found — abovo",
      description: "This shared recipe is no longer available.",
    };
  }

  const ownerLabel = recipe.user?.displayName || recipe.user?.username || "abovo";
  const title = `${recipe.title} — abovo`;
  const description =
    recipe.description?.trim() || `Shared from abovo by ${ownerLabel}.`;
  const image = resolveSocialImage(recipe.imageUrl);
  const url = `${appUrl}/shared/${id}`;

  return {
    title,
    description,
    openGraph: {
      url,
      title,
      description,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: recipe.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function SharedRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipe = await getSharedRecipe(id);

  if (!recipe) {
    notFound();
  }

  return <SharedRecipeClient id={id} />;
}

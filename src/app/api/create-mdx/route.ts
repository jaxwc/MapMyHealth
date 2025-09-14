import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function POST(request: NextRequest) {
  try {
    const { title, content } = await request.json()

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      )
    }

    // Generate a clean, URL-friendly slug from the title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
      .trim()

    if (!slug) {
      return NextResponse.json(
        { error: "Invalid title - could not generate slug" },
        { status: 400 }
      )
    }

    // Create content directory if it doesn't exist
    const contentDir = path.join(process.cwd(), "content")
    if (!fs.existsSync(contentDir)) {
      fs.mkdirSync(contentDir, { recursive: true })
    }

    // Generate the MDX content with frontmatter
    const currentDate = new Date().toISOString().split("T")[0] // YYYY-MM-DD format
    const mdxContent = `---
title: "${title}"
date: "${currentDate}"
---

${content}`

    // Create the file path
    const filePath = path.join(contentDir, `${slug}.mdx`)

    // Check if file already exists
    if (fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: "A file with this title already exists" },
        { status: 409 }
      )
    }

    // Write the file
    fs.writeFileSync(filePath, mdxContent, "utf8")

    return NextResponse.json({
      success: true,
      message: "File created successfully",
      filePath: `content/${slug}.mdx`,
      slug,
    })
  } catch (error) {
    console.error("Error creating MDX file:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}


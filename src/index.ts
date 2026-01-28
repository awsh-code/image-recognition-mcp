#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import OpenAI from "openai";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import mime from "mime-types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
});

// Create an MCP server
const server = new McpServer(
  {
    name: "Image Recongnition",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {
        list: true,
        call: true,
      },
    },
  }
);

server.registerTool(
  "describe-image",
  {
    title: "Describe Image",
    description: "Describe an image by URL",
    inputSchema: {
      imageUrl: z.string().describe("The image URL or local file path to describe"),
    },
  },
  async ({ imageUrl }) => {
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    try {
      let finalImageUrl = imageUrl;

      // Check if it's a local file
      if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) {
        try {
          const absolutePath = path.isAbsolute(imageUrl) 
            ? imageUrl 
            : path.resolve(process.cwd(), imageUrl);
          
          const fileBuffer = await fs.readFile(absolutePath);
          const extension = path.extname(absolutePath).toLowerCase();
          const mimeType = mime.lookup(extension) || "image/jpeg";
          const base64Image = fileBuffer.toString("base64");
          finalImageUrl = `data:${mimeType};base64,${base64Image}`;
        } catch (error: any) {
          throw new Error(`Failed to read local file: ${error.message}`);
        }
      }

      const response = await openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "what's in this image?" },
              {
                type: "image_url",
                image_url: {
                  url: finalImageUrl,
                  detail: "high",
                },
              },
            ],
          },
        ],
      });
      return {
        content: [{ type: "text", text: response.choices[0].message.content || "No description available" }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error calling AI: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);

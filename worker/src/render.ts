import fs from "node:fs/promises"
import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import type { WorkerJob } from "./api"
import { workerConfig } from "./config"

const execFileAsync = promisify(execFile)

export async function runBlenderRender({
  job,
  inputDir,
  outputDir,
}: {
  job: WorkerJob
  inputDir: string
  outputDir: string
}) {
  /*
   * TODO: Integrate local Codex + Blender + MCP here.
   *
   * Intended flow:
   * 1. Read project metadata from job:
   *    - render_type
   *    - project_type
   *    - style_preference
   *    - customer_notes
   *    - number_of_floors
   *    - estimated_square_meters
   *
   * 2. Inspect files in inputDir.
   *
   * 3. Ask local Codex/agent to produce Blender scene instructions.
   *
   * 4. Use MCP to control Blender:
   *    - create/import floor plan reference
   *    - build walls/massing
   *    - add materials
   *    - add lights/camera
   *    - render image(s)
   *
   * 5. Save final renders into outputDir.
   *
   * This public web app must not expose the MCP server directly.
   */
  await fs.mkdir(outputDir, { recursive: true })

  if (workerConfig.blenderCommand) {
    await execFileAsync(workerConfig.blenderCommand, [inputDir, outputDir], {
      env: {
        ...process.env,
        CUADRABOT_ORDER_ID: job.id,
        CUADRABOT_ORDER_NUMBER: job.order_number,
      },
    })
  }

  const existingOutput = await listRenderableFiles(outputDir)
  if (existingOutput.length) {
    return existingOutput
  }

  const inputImages = await listRenderableFiles(inputDir)
  if (inputImages.length) {
    const copied = path.join(outputDir, `cuadrabot-${job.order_number}-preview.png`)
    await fs.copyFile(inputImages[0], copied)
    return [copied]
  }

  const placeholder = path.join(outputDir, `cuadrabot-${job.order_number}-placeholder.png`)
  await fs.writeFile(placeholder, Buffer.from(placeholderPngBase64, "base64"))
  return [placeholder]
}

async function listRenderableFiles(directory: string) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(directory, entry.name))
    .filter((filePath) => /\.(png|jpe?g)$/i.test(filePath))
}

const placeholderPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAACXBIWXMAAAsTAAALEwEAmpwYAAABFElEQVR4nO2ZQQ7CMAwE/f+PdoegJtCkSi2HLWFS4IuVQY5ER/YUQb9RAAAAAAAAAAAAgK8x2nYty7L8N0mS8zwvSRJCVHXd932/7/t+v9/v9/v9fr/f7/f7/W63W63W6/V6vV6v1+v1er1er9fr9Xq9Xq/X6/V6vV6v1+v1er1er9fr9Xq9Xq/X6/V6vV6v1+v1er1er9fr9Xq9Xq/X6/V6vV6v1+v1er1er9fr9Xq9Xq/X6/V6vV6v1+v1er1er9fr9Xq9Xq/X6/V6vV6v1+v1er1er9fr9Xq9Xq/X6/V6vV6v1+v1+gIkSZIkyXOe53me53me53me53me53me53me53me53me53me5/kE8Tqfzkj2kxYAAAAASUVORK5CYII="

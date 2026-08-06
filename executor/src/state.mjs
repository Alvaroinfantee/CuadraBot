import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { ensurePrivateDirectory } from "./util.mjs"

export class AtomicJsonState {
  #state
  #queue = Promise.resolve()

  constructor(filePath, { initialState, validate }) {
    this.filePath = path.resolve(filePath)
    this.initialState = structuredClone(initialState)
    this.validate = validate
    this.#state = structuredClone(initialState)
    this.ready = false
  }

  async init() {
    const directory = await ensurePrivateDirectory(path.dirname(this.filePath))
    if (path.dirname(this.filePath) !== directory) {
      throw new Error("State file escaped its private directory")
    }
    try {
      const metadata = await fs.lstat(this.filePath)
      if (!metadata.isFile() || metadata.isSymbolicLink()) {
        throw new Error("State path is not a regular file")
      }
      const parsed = JSON.parse(await fs.readFile(this.filePath, "utf8"))
      this.validate(parsed)
      this.#state = parsed
    } catch (error) {
      if (error?.code !== "ENOENT") throw error
      await this.#write(this.initialState)
      this.#state = structuredClone(this.initialState)
    }
    this.ready = true
    return this
  }

  snapshot() {
    if (!this.ready) throw new Error("State is not initialized")
    return structuredClone(this.#state)
  }

  async mutate(mutator) {
    if (!this.ready) throw new Error("State is not initialized")
    const operation = this.#queue.then(async () => {
      const next = structuredClone(this.#state)
      const result = await mutator(next)
      this.validate(next)
      await this.#write(next)
      this.#state = next
      return result
    })
    this.#queue = operation.catch(() => undefined)
    return operation
  }

  async verifyWritable() {
    await this.mutate(() => undefined)
  }

  async #write(state) {
    const directory = path.dirname(this.filePath)
    const temporary = path.join(
      directory,
      `.${path.basename(this.filePath)}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`
    )
    const handle = await fs.open(temporary, "wx", 0o600)
    try {
      await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`, "utf8")
      await handle.sync()
    } finally {
      await handle.close()
    }
    try {
      await fs.rename(temporary, this.filePath)
      if (process.platform !== "win32") await fs.chmod(this.filePath, 0o600)
      if (process.platform !== "win32") {
        const directoryHandle = await fs.open(directory, "r")
        try {
          await directoryHandle.sync()
        } finally {
          await directoryHandle.close()
        }
      }
    } catch (error) {
      await fs.rm(temporary, { force: true }).catch(() => undefined)
      throw error
    }
  }
}

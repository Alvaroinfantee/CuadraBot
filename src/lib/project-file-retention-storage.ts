export type TrackedRetentionFile = {
  id: string
  storage_path: string
}

export type RetentionStorageAdapter = {
  remove: (
    paths: string[]
  ) => PromiseLike<{ error: unknown | null }>
  exists: (
    path: string
  ) => PromiseLike<{ data: boolean | null; error: unknown | null }>
}

export async function removeTrackedStorageObjects<
  File extends TrackedRetentionFile,
>(storage: RetentionStorageAdapter, files: File[]) {
  const { error } = await storage.remove(
    files.map((file) => file.storage_path)
  )
  if (!error) return { succeeded: files, failed: 0 }

  const succeeded: File[] = []
  let failed = 0
  for (const batch of chunks(files, 10)) {
    const results = await Promise.all(
      batch.map(async (file) => {
        const { data: exists, error: existsError } = await storage.exists(
          file.storage_path
        )
        if (existsError) return { file, succeeded: false }
        if (!exists) return { file, succeeded: true }

        const { error: retryError } = await storage.remove([file.storage_path])
        return { file, succeeded: !retryError }
      })
    )

    for (const result of results) {
      if (result.succeeded) succeeded.push(result.file)
      else failed += 1
    }
  }

  return { succeeded, failed }
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

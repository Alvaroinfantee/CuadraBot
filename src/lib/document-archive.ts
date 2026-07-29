export type StorageObjectLocation = {
  bucket: string
  storage_path: string
}

export type ArchiveLocation = StorageObjectLocation & {
  job_id?: string
  status: string
}

export function storageObjectKey(
  bucket: string,
  storagePath: string
) {
  return `${bucket}\u0000${storagePath}`
}

export function protectedArchivePaths(archives: ArchiveLocation[]) {
  return new Set(
    archives
      .filter((archive) => archive.status !== "deleted")
      .map((archive) =>
        storageObjectKey(archive.bucket, archive.storage_path)
      )
  )
}

export function partitionArchivedObjects<T extends StorageObjectLocation>(
  objects: T[],
  archives: ArchiveLocation[]
) {
  const protectedPaths = protectedArchivePaths(archives)
  const protectedObjects: T[] = []
  const deletableObjects: T[] = []

  for (const object of objects) {
    const target = protectedPaths.has(
      storageObjectKey(object.bucket, object.storage_path)
    )
      ? protectedObjects
      : deletableObjects
    target.push(object)
  }

  return { protectedPaths, protectedObjects, deletableObjects }
}

export function partitionRetentionObjects<
  T extends StorageObjectLocation & { job_id: string; file_role: string },
>(objects: T[], archives: ArchiveLocation[]) {
  const protectedPaths = protectedArchivePaths(archives)
  const archivedJobIds = new Set(
    archives
      .filter(
        (archive) =>
          archive.status !== "deleted" && typeof archive.job_id === "string"
      )
      .map((archive) => archive.job_id as string)
  )
  const protectedObjects: T[] = []
  const deletableObjects: T[] = []

  for (const object of objects) {
    const key = storageObjectKey(object.bucket, object.storage_path)
    const isArchived = protectedPaths.has(key)
    const isDisposableSample =
      object.file_role === "input" &&
      archivedJobIds.has(object.job_id) &&
      object.storage_path.endsWith(`/${object.job_id}/sample.pdf`)
    const protectUnregisteredInput =
      object.file_role === "input" && !isDisposableSample

    if (isArchived || protectUnregisteredInput) {
      protectedPaths.add(key)
      protectedObjects.push(object)
    } else {
      deletableObjects.push(object)
    }
  }

  return { protectedPaths, protectedObjects, deletableObjects }
}

export function partitionAbandonedUploadObjects<
  T extends StorageObjectLocation & {
    job_id: string
    file_role: string
    verified_at: string | null
  },
>(objects: T[], archives: ArchiveLocation[]) {
  const protectedPaths = protectedArchivePaths(archives)
  const archivedJobIds = new Set(
    archives
      .filter(
        (archive) =>
          archive.status !== "deleted" && typeof archive.job_id === "string"
      )
      .map((archive) => archive.job_id as string)
  )
  const protectedObjects: T[] = []
  const deletableObjects: T[] = []

  for (const object of objects) {
    const key = storageObjectKey(object.bucket, object.storage_path)
    const isArchived = protectedPaths.has(key)
    const isDisposableSample =
      archivedJobIds.has(object.job_id) &&
      object.storage_path.endsWith(`/${object.job_id}/sample.pdf`)
    const protectVerifiedHistoricalInput =
      object.file_role === "input" &&
      object.verified_at !== null &&
      !isDisposableSample

    if (isArchived || protectVerifiedHistoricalInput) {
      protectedPaths.add(key)
      protectedObjects.push(object)
    } else {
      deletableObjects.push(object)
    }
  }

  return { protectedPaths, protectedObjects, deletableObjects }
}

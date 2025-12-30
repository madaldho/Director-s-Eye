// Compress base64 image to reduce size for Firestore (max ~1MB)
export const compressImage = (base64String, maxWidth = 800, quality = 0.7) => {
  return new Promise((resolve) => {
    // If it's a sample image path, return as-is
    if (base64String.startsWith('/samples/')) {
      resolve(base64String)
      return
    }

    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let width = img.width
      let height = img.height

      // Scale down if too large
      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }

      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      // Convert to compressed JPEG
      const compressed = canvas.toDataURL('image/jpeg', quality)
      resolve(compressed)
    }

    img.onerror = () => {
      // If compression fails, return original
      resolve(base64String)
    }

    img.src = base64String
  })
}

// Check if image is too large for Firestore (>900KB to be safe)
export const isImageTooLarge = (base64String) => {
  if (!base64String || base64String.startsWith('/samples/')) return false
  // Base64 string length * 0.75 gives approximate byte size
  const sizeInBytes = (base64String.length * 3) / 4
  return sizeInBytes > 900000 // 900KB limit
}

/** Bietet Text als Datei zum Herunterladen an (Blob + Object-URL, ohne Server). */
export function downloadTextFile(filename: string, content: string, mimeType = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
  // Erst nach dem Klick freigeben, sonst bricht der Download in manchen Browsern ab.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Bietet Text als Datei zum Herunterladen an (Blob + Object-URL, ohne Server). */
export function downloadTextFile(filename: string, content: string, mimeType = 'application/json') {
  downloadBlobFile(filename, new Blob([content], { type: mimeType }))
}

/** Bietet Binärdateien wie ZIP mit derselben Download-Lebensdauer an. */
export function downloadBlobFile(filename: string, content: Blob) {
  const url = URL.createObjectURL(content)
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

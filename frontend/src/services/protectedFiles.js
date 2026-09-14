import api from './api'

export const createProtectedFileUrl = async (fileUrl) => {
  const response = await api.get(fileUrl, { responseType: 'blob' })
  return URL.createObjectURL(response.data)
}

export const revokeProtectedFileUrl = (objectUrl) => {
  if (objectUrl?.startsWith('blob:')) URL.revokeObjectURL(objectUrl)
}

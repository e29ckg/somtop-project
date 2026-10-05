import api from './api'

export const createProtectedFileUrl = async (fileUrl) => {
  // ไฟล์เก่าในฐานข้อมูลอาจบันทึก URL แบบ localhost:8088 ไว้
  const parsed = new URL(fileUrl, window.location.origin)
  const uploadPath = parsed.pathname.match(/\/uploads\/([^?#]+)$/)
  const requestUrl = import.meta.env.PROD && uploadPath
    ? `${window.location.origin}${import.meta.env.BASE_URL}uploads/${uploadPath[1]}`
    : fileUrl
  const response = await api.get(requestUrl, { responseType: 'blob' })
  return URL.createObjectURL(response.data)
}

export const revokeProtectedFileUrl = (objectUrl) => {
  if (objectUrl?.startsWith('blob:')) URL.revokeObjectURL(objectUrl)
}

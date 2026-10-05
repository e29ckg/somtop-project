import api from './api'

export const fetchProtectedFile = (fileUrl) => {
  // ไฟล์เก่าในฐานข้อมูลอาจบันทึก URL ที่ชี้ไปยังพอร์ต API โดยตรงไว้
  const parsed = new URL(fileUrl, window.location.origin)
  const uploadPath = parsed.pathname.match(/\/uploads\/([^?#]+)$/)
  const requestUrl = import.meta.env.PROD && uploadPath
    ? `${window.location.origin}${import.meta.env.BASE_URL}uploads/${uploadPath[1]}`
    : fileUrl
  return api.get(requestUrl, { responseType: 'blob' })
}

export const createProtectedFileUrl = async (fileUrl) => {
  const response = await fetchProtectedFile(fileUrl)
  return URL.createObjectURL(response.data)
}

export const revokeProtectedFileUrl = (objectUrl) => {
  if (objectUrl?.startsWith('blob:')) URL.revokeObjectURL(objectUrl)
}

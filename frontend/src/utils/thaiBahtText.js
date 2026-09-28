const digits = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
const places = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน']

const readGroup = (value, hasHigherGroup = false) => {
  const text = String(Number(value))
  return [...text].map((char, index) => {
    const digit = Number(char)
    const place = text.length - index - 1
    if (!digit) return ''
    if (place === 1) return digit === 1 ? 'สิบ' : digit === 2 ? 'ยี่สิบ' : `${digits[digit]}สิบ`
    if (place === 0 && digit === 1 && (hasHigherGroup || Number(text.slice(0, -1)) > 0)) return 'เอ็ด'
    return digits[digit] + places[place]
  }).join('')
}

const readNumber = value => {
  if (value === '0') return 'ศูนย์'
  const groups = value.match(/.{1,6}(?=(.{6})*$)/g)
  return groups.map((group, index) => {
    if (!Number(group)) return ''
    return readGroup(group, index > 0 && Number(groups.slice(0, index).join('')) > 0) + 'ล้าน'.repeat(groups.length - index - 1)
  }).join('')
}

export const thaiBahtText = amount => {
  const value = Number(amount)
  if (!Number.isFinite(value) || value < 0) return ''
  const [baht, satang] = value.toFixed(2).split('.')
  return `${readNumber(baht)}บาท${satang === '00' ? 'ถ้วน' : `${readGroup(satang)}สตางค์`}`
}

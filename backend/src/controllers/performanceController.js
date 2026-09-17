const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const scope = (c, a = '') => c ? ` AND ${a}court_code = ?` : '';
const params = (c, v = []) => c ? [...v, c] : v;
const range = y => ({ start: `${y}-04-01`, end: `${Number(y) + 1}-04-01` });
const thaiDate = date => { const [y, m, d] = date.split('-'); const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']; return `${Number(d)} ${months[Number(m) - 1]} ${Number(y) + 543}`; };

exports.getReport = async (req, res) => {
  try {
    const now = new Date(); const year = Number(req.query.year) || (now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear());
    const { start, end } = range(year); const person = req.query.somtop_id ? Number(req.query.somtop_id) : null;
    // รายการบุคคลต้องคงอยู่ครบ เพื่อไม่ให้ dropdown หายหลังเลือกบุคคล
    const [allPeople] = await pool.query(`SELECT s.id, CONCAT(s.title,s.first_name,' ',s.last_name) full_name, s.occupation, sp.name position_name FROM somtop s LEFT JOIN somtop_positions sp ON sp.id=s.position_id WHERE s.status='ใช้งาน'${scope(req.user.court_code, 's.')} ORDER BY COALESCE(sp.level, 999999), s.join_date IS NULL, s.join_date, s.first_name, s.last_name`, params(req.user.court_code));
    const [duty] = await pool.query(`SELECT ds.somtop_id, COUNT(*) duty_days FROM duty_schedules ds WHERE ds.duty_date >= ? AND ds.duty_date < ?${scope(req.user.court_code, 'ds.')} GROUP BY ds.somtop_id`, params(req.user.court_code, [start, end]));
    const [leaves] = await pool.query(`SELECT lr.somtop_id, lt.name leave_type, COALESCE(SUM(lr.total_days),0) total_days, COUNT(*) leave_count FROM leave_requests lr JOIN leave_types lt ON lt.id=lr.leave_type_id WHERE lr.start_date < ? AND lr.end_date >= ?${scope(req.user.court_code, 'lr.')} GROUP BY lr.somtop_id, lt.name`, params(req.user.court_code, [end, start]));
    const [events] = await pool.query(`SELECT ep.somtop_id, COUNT(*) activity_count FROM event_participants ep JOIN events e ON e.id=ep.event_id WHERE e.start_date >= ? AND e.start_date < ? AND ep.status IN ('เข้าร่วม','ยืนยันเข้าร่วม')${scope(req.user.court_code, 'e.')} GROUP BY ep.somtop_id`, params(req.user.court_code, [start, end]));
    const [swaps] = await pool.query(`SELECT requester_somtop_id somtop_id, COUNT(*) swap_count FROM duty_swaps sw WHERE sw.request_date >= ? AND sw.request_date < ?${scope(req.user.court_code, 'sw.')} GROUP BY requester_somtop_id`, params(req.user.court_code, [start, end]));
    const dm = Object.fromEntries(duty.map(x => [x.somtop_id, Number(x.duty_days)])); const em = Object.fromEntries(events.map(x => [x.somtop_id, Number(x.activity_count)])); const sm = Object.fromEntries(swaps.map(x => [x.somtop_id, Number(x.swap_count)])); const lm = {};
    leaves.forEach(x => { (lm[x.somtop_id] ||= {})[x.leave_type] = { days: Number(x.total_days), count: Number(x.leave_count) }; });
    const records = allPeople.filter(p => !person || Number(p.id) === person).map(p => ({ ...p, duty_days: dm[p.id] || 0, duty_hours: (dm[p.id] || 0) * 7.5, activity_count: em[p.id] || 0, swap_count: sm[p.id] || 0, leaves: lm[p.id] || {} }));
    res.json({ year, start, end, records, leave_types: [...new Set(leaves.map(x => x.leave_type))], filters: { people: allPeople } });
  } catch (error) { console.error('Performance report error:', error); res.status(500).json({ message: 'ไม่สามารถจัดทำรายงานประเมินผลงานได้' }); }
};

exports.exportWord = async (req, res) => {
  try {
    const year = Number(req.query.year); const person = Number(req.query.somtop_id); if (!year || !person) return res.status(400).json({ message: 'กรุณาเลือกรอบปีและบุคคล' });
    const { start, end } = range(year);
    const fake = { ...req, query: { year, somtop_id: person } }; let data; const original = res.json; res.json = value => { data = value; }; await exports.getReport(fake, res); res.json = original;
    const row = data?.records?.[0]; if (!row) return res.status(404).json({ message: 'ไม่พบข้อมูลบุคคล' });
    const template = fs.readFileSync(path.join(__dirname, '../../templates/performance_evaluation_template.docx'), 'binary'); const doc = new Docxtemplater(new PizZip(template), { paragraphLoop: true, linebreaks: true });
    const personalLeaves = row.leaves || {};
    const combinedPersonalLeave = ['ลากิจส่วนตัว', 'ลากิจ', 'ลาพักผ่อน'].reduce((sum, key) => sum + Number(personalLeaves[key]?.days || 0), 0);
    const sickLeave = personalLeaves['ลาป่วย'];
    const abroadLeave = personalLeaves['ลาไปต่างประเทศ'];
    doc.render({ ...row, evaluation_year: year + 543, start_date_th: thaiDate(start), end_date_th: thaiDate(`${Number(year) + 1}-03-31`), personal_leave_days: combinedPersonalLeave || '-', sick_leave_count: sickLeave?.count || '-', absent_days: '-', abroad_leave_days: abroadLeave?.days || '-', leave_summary: '' });
    const buffer = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }); res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`ประเมินผลงาน_${row.full_name}_รอบปี_${year + 543}.docx`)}`); res.send(buffer);
  } catch (error) { console.error('Performance Word export error:', error); res.status(500).json({ message: 'ไม่สามารถสร้างไฟล์ Word ได้' }); }
};

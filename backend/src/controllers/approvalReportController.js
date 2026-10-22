const { loadReport, buildWorkbook } = require('../services/approvalReport');

exports.preview = async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const report = await loadReport(req.user, req.query);
    res.json({ report });
};

exports.exportExcel = async (req, res) => {
    const report = await loadReport(req.user, req.query);
    if (!report.rows.length) return res.status(400).json({ message: 'ไม่มีรายชื่อผู้ปฏิบัติหน้าที่ตามตัวกรองที่เลือก' });
    const buffer = await buildWorkbook(report).xlsx.writeBuffer();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`หน้างบประกอบการอนุมัติ_${report.month}.xlsx`)}`);
    res.send(buffer);
};

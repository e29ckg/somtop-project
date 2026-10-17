const collator = new Intl.Collator('th', { numeric: true, sensitivity: 'base' });

// Replacements keep the original member's place in the team.
const teamMemberOrderSql = `CASE COALESCE(
        (SELECT sw.requester_somtop_id FROM duty_swaps sw WHERE sw.schedule_id = ds.id ORDER BY sw.id LIMIT 1),
        ds.somtop_id
    )
    WHEN t.member_one_somtop_id THEN 1
    WHEN t.member_two_somtop_id THEN 2
    ELSE 3 END AS team_member_order`;

function compareDutySchedules(a, b) {
    const dateOrder = String(a.duty_date).localeCompare(String(b.duty_date));
    if (dateOrder) return dateOrder;
    const typeOrder = Number(a.duty_type_id || 0) - Number(b.duty_type_id || 0);
    if (typeOrder) return typeOrder;
    if (!a.team_name && b.team_name) return 1;
    if (a.team_name && !b.team_name) return -1;
    const teamOrder = collator.compare(a.team_name || '', b.team_name || '')
        || Number(a.team_id || 0) - Number(b.team_id || 0);
    if (teamOrder) return teamOrder;
    if (a.team_id && b.team_id) {
        const memberOrder = Number(a.team_member_order || 3) - Number(b.team_member_order || 3);
        if (memberOrder) return memberOrder;
    }
    return collator.compare(a.full_name || '', b.full_name || '') || Number(a.id || 0) - Number(b.id || 0);
}

module.exports = { compareDutySchedules, teamMemberOrderSql };

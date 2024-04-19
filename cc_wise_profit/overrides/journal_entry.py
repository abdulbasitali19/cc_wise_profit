import frappe


@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def get_against_jv(doctype, txt, searchfield, start, page_len, filters):
	if not frappe.db.has_column("Journal Entry", searchfield):
		return []

	return frappe.db.sql(
		"""
		SELECT jv.name, jv.posting_date, jv.user_remark, jv.cheque_no
		FROM `tabJournal Entry` jv, `tabJournal Entry Account` jv_detail
		WHERE jv_detail.parent = jv.name
			AND jv_detail.account = %(account)s
			AND IFNULL(jv_detail.party, '') = %(party)s
			AND (
				jv_detail.reference_type IS NULL
				OR jv_detail.reference_type = ''
			)
			AND jv.docstatus = 1
			AND jv.`{0}` LIKE %(txt)s
		ORDER BY jv.name DESC
		LIMIT %(limit)s offset %(offset)s
		""".format(
			searchfield
		),
		dict(
			account=filters.get("account"),
			party=cstr(filters.get("party")),
			txt="%{0}%".format(txt),
			offset=start,
			limit=page_len,
		),
	)
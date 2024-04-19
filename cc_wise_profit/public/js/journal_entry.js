

frappe.provide("erpnext.accounts");
frappe.provide("erpnext.journal_entry");

    erpnext.accounts.JournalEntry = class JournalEntry extends frappe.ui.form.Controller {
        onload() {
            this.load_defaults();
            this.setup_queries();
            erpnext.accounts.dimensions.setup_dimension_filters(this.frm, this.frm.doctype);
        }
    
        onload_post_render() {
            cur_frm.get_field("accounts").grid.set_multiple_add("account");
        }
    
        load_defaults() {
            //this.frm.show_print_first = true;
            if(this.frm.doc.__islocal && this.frm.doc.company) {
                frappe.model.set_default_values(this.frm.doc);
                $.each(this.frm.doc.accounts || [], function(i, jvd) {
                    frappe.model.set_default_values(jvd);
                });
                var posting_date = this.frm.doc.posting_date;
                if(!this.frm.doc.amended_from) this.frm.set_value('posting_date', posting_date || frappe.datetime.get_today());
            }
        }
    
        setup_queries() {
            var me = this;
    
            me.frm.set_query("account", "accounts", function(doc, cdt, cdn) {
                return erpnext.journal_entry.account_query(me.frm);
            });
    
            me.frm.set_query("party_type", "accounts", function(doc, cdt, cdn) {
                const row = locals[cdt][cdn];
    
                return {
                    query: "erpnext.setup.doctype.party_type.party_type.get_party_type",
                    filters: {
                        'account': row.account
                    }
                }
            });
    
            me.frm.set_query("reference_name", "accounts", function(doc, cdt, cdn) {
                var jvd = frappe.get_doc(cdt, cdn);
    
                // journal entry
                if(jvd.reference_type==="Journal Entry") {
                    frappe.model.validate_missing(jvd, "account");
                    return {
                        query: "cc_wise_profit.overrides.journal_entry.get_against_jv",
                        filters: {
                            account: jvd.account,
                            party: jvd.party
                        }
                    };
                }
    
                var out = {
                    filters: [
                        [jvd.reference_type, "docstatus", "=", 1]
                    ]
                };
    
                if(in_list(["Sales Invoice", "Purchase Invoice"], jvd.reference_type)) {
                    out.filters.push([jvd.reference_type, "outstanding_amount", "!=", 0]);
                    // Filter by cost center
                    if(jvd.cost_center) {
                        out.filters.push([jvd.reference_type, "cost_center", "in", ["", jvd.cost_center]]);
                    }
                    // account filter
                    frappe.model.validate_missing(jvd, "account");
                    var party_account_field = jvd.reference_type==="Sales Invoice" ? "debit_to": "credit_to";
                    out.filters.push([jvd.reference_type, party_account_field, "=", jvd.account]);
    
                }
    
                if(in_list(["Sales Order", "Purchase Order"], jvd.reference_type)) {
                    // party_type and party mandatory
                    frappe.model.validate_missing(jvd, "party_type");
                    frappe.model.validate_missing(jvd, "party");
    
                    out.filters.push([jvd.reference_type, "per_billed", "<", 100]);
                }
    
                if(jvd.party_type && jvd.party) {
                    var party_field = "";
                    if(jvd.reference_type.indexOf("Sales")===0) {
                        var party_field = "customer";
                    } else if (jvd.reference_type.indexOf("Purchase")===0) {
                        var party_field = "supplier";
                    }
    
                    if (party_field) {
                        out.filters.push([jvd.reference_type, party_field, "=", jvd.party]);
                    }
                }
    
                return out;
            });
    
    
        }
    
        reference_name(doc, cdt, cdn) {
            var d = frappe.get_doc(cdt, cdn);
    
            if(d.reference_name) {
                if (d.reference_type==="Purchase Invoice" && !flt(d.debit)) {
                    this.get_outstanding('Purchase Invoice', d.reference_name, doc.company, d);
                } else if (d.reference_type==="Sales Invoice" && !flt(d.credit)) {
                    this.get_outstanding('Sales Invoice', d.reference_name, doc.company, d);
                } else if (d.reference_type==="Journal Entry" && !flt(d.credit) && !flt(d.debit)) {
                    this.get_outstanding('Journal Entry', d.reference_name, doc.company, d);
                }
            }
        }
    
        get_outstanding(doctype, docname, company, child) {
            var args = {
                "doctype": doctype,
                "docname": docname,
                "party": child.party,
                "account": child.account,
                "account_currency": child.account_currency,
                "company": company
            }
    
            return frappe.call({
                method: "erpnext.accounts.doctype.journal_entry.journal_entry.get_outstanding",
                args: { args: args},
                callback: function(r) {
                    if(r.message) {
                        $.each(r.message, function(field, value) {
                            frappe.model.set_value(child.doctype, child.name, field, value);
                        })
                    }
                }
            });
        }
    
        accounts_add(doc, cdt, cdn) {
            var row = frappe.get_doc(cdt, cdn);
            $.each(doc.accounts, function(i, d) {
                if(d.account && d.party && d.party_type) {
                    row.account = d.account;
                    row.party = d.party;
                    row.party_type = d.party_type;
                }
            });
    
            // set difference
            if(doc.difference) {
                if(doc.difference > 0) {
                    row.credit_in_account_currency = doc.difference;
                    row.credit = doc.difference;
                } else {
                    row.debit_in_account_currency = -doc.difference;
                    row.debit = -doc.difference;
                }
            }
            cur_frm.cscript.update_totals(doc);
    
            erpnext.accounts.dimensions.copy_dimension_from_first_row(this.frm, cdt, cdn, 'accounts');
        }
    }
    
    



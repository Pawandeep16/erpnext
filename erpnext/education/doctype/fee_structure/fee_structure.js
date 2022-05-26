// Copyright (c) 2017, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

frappe.provide("erpnext.accounts.dimensions");

frappe.ui.form.on("Fee Structure", {
	setup: function (frm) {
		frm.add_fetch(
			"company",
			"default_receivable_account",
			"receivable_account"
		);
		frm.add_fetch("company", "default_income_account", "income_account");
		frm.add_fetch("company", "cost_center", "cost_center");
	},

	company: function (frm) {
		erpnext.accounts.dimensions.update_dimension(frm, frm.doctype);
	},

	onload: function (frm) {
		frm.set_query("academic_term", function () {
			return {
				filters: {
					academic_year: frm.doc.academic_year,
				},
			};
		});

		frm.set_query("receivable_account", function (doc) {
			return {
				filters: {
					account_type: "Receivable",
					is_group: 0,
					company: doc.company,
				},
			};
		});
		frm.set_query("income_account", function (doc) {
			return {
				filters: {
					account_type: "Income Account",
					is_group: 0,
					company: doc.company,
				},
			};
		});

		erpnext.accounts.dimensions.setup_dimension_filters(frm, frm.doctype);
	},

	refresh: function (frm) {
		if (frm.doc.docstatus === 1) {
			frm.add_custom_button(__("Create Fee Schedule"), function () {
				frm.events.make_fee_schedule(frm);
			}).addClass("btn-primary");
		}
	},

	make_fee_schedule: function (frm) {
		frappe.model.open_mapped_doc({
			method: "erpnext.education.doctype.fee_structure.fee_structure.make_fee_schedule",
			frm: frm,
		});
	},

	one_discount: function (frm) {
		var after_discount = 0;

		for (var i = 0; i < frm.doc.components.length; i++) {
			after_discount =
				frm.doc.components[i].amount -
				(frm.doc.components[i].amount *
					frm.doc.components[i].one_sibling_discount) /
					100;
			console.log(after_discount);
			frm.doc.components[i].amount_after_discount = after_discount;

			refresh_field("components");
		}
	},

	two_discount: function (frm) {
		var after_discount = 0;
		for (var i = 0; i < frm.doc.components.length; i++) {
			after_discount =
				frm.doc.components[i].amount -
				(frm.doc.components[i].amount *
					frm.doc.components[i].two_sibling_discount) /
					100;
			console.log(after_discount);
			frm.doc.components[i].amount_after_discount = after_discount;

			refresh_field("components");
		}
	},

	calculate_total_amount: function (frm) {
		var total_amount = 0;
		for (var i = 0; i < frm.doc.components.length; i++) {
			total_amount += frm.doc.components[i].amount_after_discount;
		}
		frm.set_value("total_amount", total_amount);
	},
});

frappe.ui.form.on("Fee Component", {
	amount: function (frm) {
		frm.trigger("calculate_total_discount");
	},
	one_sibling_discount: function (frm) {
		frm.trigger("one_discount");
		frm.trigger("calculate_total_discount");
	},

	two_sibling_discount: function (frm) {
		frm.trigger("two_discount");
		frm.trigger("calculate_total_discount");
	},
});

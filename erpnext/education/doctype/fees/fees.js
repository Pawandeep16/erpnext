// Copyright (c) 2017, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

frappe.provide("erpnext.accounts.dimensions");

frappe.ui.form.on("Fees", {
  setup: function (frm) {
    frm.add_fetch("fee_structure", "receivable_account", "receivable_account");
    frm.add_fetch("fee_structure", "income_account", "income_account");
    frm.add_fetch("fee_structure", "cost_center", "cost_center");
  },

  company: function (frm) {
    erpnext.accounts.dimensions.update_dimension(frm, frm.doctype);
  },

  onload: function (frm) {
    // END FETCH

    // SET DUE DATE
    if (frm.doc.posting_date) {
      var today = new Date(frm.doc.posting_date);
      console.log(today);

      var tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 20);
      console.log(tomorrow.toLocaleDateString());
      frm.set_value("due_date", tomorrow);
    }
    // END SET

    frm.set_query("academic_term", function () {
      return {
        filters: {
          academic_year: frm.doc.academic_year,
        },
      };
    });
    frm.set_query("fee_structure", function () {
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
    if (!frm.doc.posting_date) {
      frm.doc.posting_date = frappe.datetime.get_today();
    }

    erpnext.accounts.dimensions.setup_dimension_filters(frm, frm.doctype);
  },

  refresh: function (frm) {
    if (frm.doc.docstatus == 0 && frm.doc.set_posting_time) {
      frm.set_df_property("posting_date", "read_only", 0);
      frm.set_df_property("posting_time", "read_only", 0);
    } else {
      frm.set_df_property("posting_date", "read_only", 1);
      frm.set_df_property("posting_time", "read_only", 1);
    }
    if (frm.doc.docstatus > 0) {
      frm.add_custom_button(
        __("Accounting Ledger"),
        function () {
          frappe.route_options = {
            voucher_no: frm.doc.name,
            from_date: frm.doc.posting_date,
            to_date: moment(frm.doc.modified).format("YYYY-MM-DD"),
            company: frm.doc.company,
            group_by: "",
            show_cancelled_entries: frm.doc.docstatus === 2,
          };
          frappe.set_route("query-report", "General Ledger");
        },
        __("View")
      );
      frm.add_custom_button(
        __("Payments"),
        function () {
          frappe.set_route("List", "Payment Entry", {
            "Payment Entry Reference.reference_name": frm.doc.name,
          });
        },
        __("View")
      );
    }
    if (frm.doc.docstatus === 1 && frm.doc.outstanding_amount > 0) {
      frm.add_custom_button(
        __("Payment Request"),
        function () {
          frm.events.make_payment_request(frm);
        },
        __("Create")
      );
      frm.page.set_inner_btn_group_as_primary(__("Create"));
    }
    if (frm.doc.docstatus === 1 && frm.doc.outstanding_amount != 0) {
      frm.add_custom_button(
        __("Payment"),
        function () {
          frm.events.make_payment_entry(frm);
        },
        __("Create")
      );
      frm.page.set_inner_btn_group_as_primary(__("Create"));
    }
  },

  student: function (frm) {
    if (frm.doc.student) {
      console.log("hi");
    }
  },

  make_payment_request: function (frm) {
    if (!frm.doc.student_email) {
      frappe.msgprint(
        __(
          "Please set the Email ID for the Student to send the Payment Request"
        )
      );
    } else {
      frappe.call({
        method:
          "erpnext.accounts.doctype.payment_request.payment_request.make_payment_request",
        args: {
          dt: frm.doc.doctype,
          dn: frm.doc.name,
          party_type: "Student",
          party: frm.doc.student,
          recipient_id: frm.doc.student_email,
        },
        callback: function (r) {
          if (!r.exc) {
            var doc = frappe.model.sync(r.message);
            frappe.set_route("Form", doc[0].doctype, doc[0].name);
          }
        },
      });
    }
  },

  make_payment_entry: function (frm) {
    return frappe.call({
      method:
        "erpnext.accounts.doctype.payment_entry.payment_entry.get_payment_entry",
      args: {
        dt: frm.doc.doctype,
        dn: frm.doc.name,
      },
      callback: function (r) {
        var doc = frappe.model.sync(r.message);
        frappe.set_route("Form", doc[0].doctype, doc[0].name);
      },
    });
  },

  set_posting_time: function (frm) {
    frm.refresh();
  },

  academic_term: function () {
    frappe.ui.form.trigger("Fees", "program");
  },

  fee_structure: function (frm) {
    frm.set_value("components", "");
    if (frm.doc.fee_structure) {
      frappe.call({
        method: "erpnext.education.api.get_fee_components",
        args: {
          fee_structure: frm.doc.fee_structure,
        },
        callback: function (r) {
          if (r.message) {
            $.each(r.message, function (i, d) {
              var row = frappe.model.add_child(
                frm.doc,
                "Fee Component",
                "components"
              );
              row.fees_category = d.fees_category;
              row.description = d.description;
              row.amount = d.amount;
              row.one_sibling_discount = d.one_sibling_discount;
              row.two_sibling_discount = d.two_sibling_discount;
              row.amount_after_discount = d.amount_after_discount;
            });
          }
          refresh_field("components");
          frm.trigger("calculate_total_amount");
        },
      });
    }
  },

  // Siblings
  student: function (frm) {
    frm.set_value("siblings", "");
    frm.set_value("bus_component", "");
    if (frm.doc.student) {
      frappe.call({
        method: "erpnext.education.api.get_sibling_details",
        args: {
          student: frm.doc.student,
        },
        callback: function (r) {
          if (r.message) {
            $.each(r.message, function (i, d) {
              var row = frappe.model.add_child(
                frm.doc,
                "Student Sibling",
                "siblings"
              );
              row.full_name = d.full_name;
              row.gender = d.gender;
              row.program = d.program;
              row.date_of_birth = d.date_of_birth;
            });
          }
          cur_frm.refresh_field("siblings");
          frm.trigger("calculate_no_of_siblings");
        },
      });

      //   frappe.call({
      //     method: "erpnext.education.api.get_current_enrollment",
      //     args: {
      //       student: frm.doc.student,
      //       academic_year: frm.doc.academic_year,
      //     },
      //     callback: function (r) {
      //       if (r) {
      //         console.log(r);
      //         $.each(r.message, function (i, d) {
      //           frm.set_value(i, d);
      //         });
      //       }
      //     },
      //   });

      frappe.call({
        method: "erpnext.education.api.get_programEnrollment_details",
        args: { user: frm.doc.student },
        callback: function (r) {
          if (r) {
            $.each(r.message, function (i, d) {
              frm.set_value("program_enrollment", d.name);
              frm.set_value("program", d.program);
              frm.set_value("academic_year", d.academic_year);
              frm.set_value("academic_term", d.academic_term);
            });
          }
        },
      });
    }

    // FETCHING STUDENT DETAILS
  },

  program_enrollment: function (frm) {
    if (frm.doc.program_enrollment) {
      frappe.call({
        method: "erpnext.education.api.get_bus_detail",
        args: { user: frm.doc.program_enrollment },
        callback: function (r) {
          if (r.message) {
            var route = r.message[1];
            console.log(route);
            if (r.message[0] == "Institute's Bus") {
              frappe.msgprint(
                `The mode of Transportation is ${r.message[0]} and the bus is ${r.message[1]}  `
              );
            } else {
              frappe.msgprint(`The mode of Transportation is ${r.message[0]} `);
            }
            frappe
              .call({
                method: "erpnext.education.api.get_bus_route",
                args: { user: route },
              })
              .done((r) => {
                let entry = frm.add_child("bus_component");
                console.log(r.message);
                entry.bus_route = r.message[0];
                entry.description = r.message[1];
                entry.amount = r.message[2];
                refresh_field("bus_component");
              });
          }
        },
      });
    }
  },

  // transportation_detail: function (frm) {

  // },

  // Sibings end
  calculate_no_of_siblings: function (frm) {
    frm.set_value("no_of_siblings", 0);
    if (frm.doc.siblings) {
      if (frm.doc.siblings.length > 0) {
        frm.set_value("no_of_siblings", frm.doc.siblings.length);
      }
    }
    cur_frm.refresh_field("no_of_siblings");

    frappe.call({
      method: "erpnext.education.api.get_details",
      args: { user: frm.doc.student },
      callback: (data) => {
        var s_date_of_birth = data.message[0];
        frm.set_value("student_email", data.message[2]);

        if (frm.doc.no_of_siblings == 1) {
          for (var i = 0; i < frm.doc.siblings.length; i++) {
            if (s_date_of_birth > frm.doc.siblings[i].date_of_birth) {
              frappe.msgprint("He is eligible for Discount 50% ");
            }
          }
        } else if (frm.doc.no_of_siblings == 2) {
          for (var i = 0; i < frm.doc.siblings.length; i++) {
            var sibling1 = frm.doc.siblings[0].date_of_birth;
            var sibling2 = frm.doc.siblings[1].date_of_birth;
          }

          if (s_date_of_birth > sibling1 && s_date_of_birth > sibling2) {
            frappe.msgprint("Eligible for 50% ");
          } else if (
            (s_date_of_birth > sibling1 && s_date_of_birth < sibling2) ||
            (s_date_of_birth < sibling1 && s_date_of_birth > sibling2)
          ) {
            frappe.msgprint("He is eligible for 25% discount");
          } else if (s_date_of_birth < sibling1 && s_date_of_birth < sibling2) {
            frappe.msgprint("He is Not Eligible for Sibling discount");
          }
        } else if (frm.doc.no_of_siblings > 2 || !frm.doc.siblings) {
          frappe.msgprint(" Not Eligible for Sibling discount");
        }
      },
    });
  },

  // Discount calculations.

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
    var grand_total = 0,
      grand_total0 = 0,
      grand_total1 = 0;
    var mang_discount = 0;
    var bus_grand = 0;

    for (var i = 0; i < frm.doc.components.length; i++) {
      grand_total0 += frm.doc.components[i].amount_after_discount;
    }

    console.log(grand_total0);

    if (frm.doc.bus_component) {
      for (var i = 0; i < frm.doc.bus_component.length; i++) {
        grand_total1 += frm.doc.bus_component[i].amount;
      }

      console.log(grand_total1);
    }

    if (grand_total0 && grand_total1) {
      grand_total = grand_total0 + grand_total1;
    } else {
      grand_total = grand_total0;
    }
    if (frm.doc.management_discount) {
      mang_discount =
        frm.doc.grand_total -
        (frm.doc.grand_total * frm.doc.management_discount) / 100;

      grand_total = mang_discount;
    }

    frm.set_value("grand_total", grand_total);
  },
  // Managemetal Discount

  management_discount: function (frm) {
    frm.trigger("calculate_total_amount");
    frm.refresh_field("grand_total");
  },
  // MD END

  // changes
  bus_component: function (frm) {
    frm.set_value("bus_component", "");
    if (frm.doc.bus_components) {
      frappe.call({
        method: "erpnext.education.api.get_bus_component",
        args: {
          bus_components: frm.doc.bus_components,
        },
        callback: function (r) {
          if (r.message) {
            $.each(r.message, function (i, d) {
              var row = frappe.model.add_child(
                frm.doc,
                "Bus Component",
                "bus_component"
              );
              row.bus_route = d.bus_route;
              row.description = d.description;
              row.amount = d.amount;
            });
          }
          refresh_field("bus_component");
          frm.trigger("calculate_total_amount");
        },
      });
    }
  },
});

frappe.ui.form.on("Fee Component", {
  // amount_after_discount: function (frm, cdt, cdn) {
  // },
  amount: function (frm) {
    frm.trigger("calculate_total_amount");
  },
  one_sibling_discount: function (frm) {
    frm.trigger("one_discount");
    frm.trigger("calculate_total_amount");
  },
  two_sibling_discount: function (frm) {
    frm.trigger("two_discount");
    frm.trigger("calculate_total_amount");
  },
});

frappe.ui.form.on("Bus Component", {
  // amount_after_discount: function (frm, cdt, cdn) {
  // },
  bus_route: function (frm) {
    frm.trigger("calculate_total_amount");
  },
  amount: function (frm) {
    frm.trigger("calculate_total_amount");
  },
});

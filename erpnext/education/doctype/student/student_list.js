frappe.listview_settings["Student"] = {
  add_fields: ["title", "name", "gender"],
  // set default filters

  before_render(doc) {
    console.log("y");

    // triggers before every render of list records
  },
  get_indicator(doc, frm) {
    // customize indicator color
    // doc.status == "Enabled"
    if (doc.enabled == 1) {
      frappe.call({
        method: "erpnext.education.api.get_over_due",
        callback: function (r) {
          if (r) {
            $.each(r.message, function (i, d) {
              if ((i, d.student === doc.name)) {
                frappe.call({
                  method: "frappe.client.set_value",
                  args: {
                    doctype: "Student",
                    name: doc.name,
                    fieldname: "enabled",
                    value: 0,
                  },
                  freeze: true,
                  callback: function (r) {
                    frappe.msgprint(
                      __(
                        `Student ${doc.title} has been Disable from Access because of overdue fee`
                      )
                    );
                  },
                });
              }
            });
          }
        },
      });
    }
    if (doc.enabled == 0) {
      frappe.call({
        method: "erpnext.education.api.get_paid",
        callback: function (r) {
          if (r) {
            $.each(r.message, function (i, d) {
              if ((i, d.student === doc.name)) {
                frappe.call({
                  method: "frappe.client.set_value",
                  args: {
                    doctype: "Student",
                    name: doc.name,
                    fieldname: "enabled",
                    value: 1,
                  },
                  freeze: true,
                  callback: function (r) {
                    console.log(doc.enabled);
                    frappe.msgprint(
                      __(
                        `Student ${doc.title} has been Enabled from Access fee has been paid`
                      )
                    );
                  },
                });
              }
            });
          }
        },
      });
    }
    console.log(doc.enabled);
    if (doc.enabled) {
      return [__("Enabled"), "blue", "enabled,=,1"];
    } else {
      return [__("Disabled"), "darkgray", "disabled,=,1"];
    }
  },
};

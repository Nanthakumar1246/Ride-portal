



export const filterConfig = {

  risks: {
    fields: [
      { name: "account", label: "Account", type: "text" },
      {
        name: "status", label: "Status", type: "select",
        options: ["Open", "Resolved", "Approved & Closed", "Cancelled"]
      },
      {
        name: "priority", label: "Priority", type: "select",
        options: ["Critical", "High", "Medium", "Low"]
      },
      {
        name: "category", label: "Category", type: "select",
        options: ["Schedule", "Scope", "Technical", "Resource", "Security", "Operational", "Revenue Risk"]
      },
      {
        name: "probability", label: "Probability", type: "select",
        options: ["Rare", "Possible", "Likely (Regularly)"]
      },
      {
        name: "impact", label: "Impact", type: "select",
        options: ["Minor", "Moderate", "Major"]
      }
    ]
  },



  issues: {
    fields: [
      { name: "account", label: "Account", type: "text" },
      { name: "search", label: "Search", type: "text" },
      {
        name: "status", label: "Status", type: "select",
        options: ["Open", "Resolved", "Approved & Closed", "Cancelled"]
      },
      {
        name: "priority", label: "Priority", type: "select",
        options: ["Low", "Medium", "High", "Critical"]
      },
      {
        name: "category", label: "Category", type: "select",
        options: ["Technical", "Operational", "Resource", "Infrastructure", "Application", "Network", "Security", "Performance", "Revenue Risk"]
      }
    ]
  },



  dependencies: {
    fields: [
      { name: "account", label: "Account", type: "text" },
      {
        name: "status", label: "Status", type: "select",
        options: ["Open", "Resolved", "Approved & Closed", "Cancelled"]
      },
      {
        name: "priority", label: "Priority", type: "select",
        options: ["Critical", "High", "Medium", "Low"]
      },
      {
        name: "type", label: "Type", type: "select",
        options: ["Internal", "External", "Vendor", "Client", "Cross-Team"]
      }
    ]
  },


  escalations: {
    fields: [
      { name: "account", label: "Account", type: "text" },
      {
        name: "status", label: "Status", type: "select",
        options: ["Open", "Resolved", "Approved & Closed", "Cancelled"]
      },
      {
        name: "priority", label: "Priority", type: "select",
        options: ["Critical", "High", "Medium", "Low"]
      },
      {
        name: "category", label: "Category", type: "select",
        options: ["Performance", "Availability", "Security", "Quality", "Communication", "Resource", "Budget", "Scope", "Revenue Risk"]
      }
    ]
  },


  actions: {
    fields: [
      { name: "account", label: "Account", type: "text" },
      {
        name: "status", label: "Status", type: "select",
        options: ["Open", "Resolved", "Approved & Closed", "Cancelled"]
      },
      {
        name: "priority", label: "Priority", type: "select",
        options: ["Critical", "High", "Medium", "Low"]
      },
      {
        name: "related_to_type", label: "Related To", type: "select",
        options: ["Risk", "Issue"]
      }

    ]
  }
};

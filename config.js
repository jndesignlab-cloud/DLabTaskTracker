window.DLAB_CONFIG = {
  appName: "DesignLab Task Tracker",
  version: "2.1.0",
  owner: "DesignLab Creative Studio",

  // Browser-safe Supabase project credentials. Row Level Security must remain enabled.
  // NEVER place a service_role, secret, or server key in this file.
  supabaseUrl: "https://kxxdaqsvyfmvjfgqejjk.supabase.co",
  supabasePublishableKey: "sb_publishable_sf8nVzTHs3FMYEa-934MIQ_rP-J7CFj",

  // The public login uses a username, while Supabase Auth requires an email internally.
  // Create this single user manually in Supabase Authentication → Users.
  ownerUsername: "designlab",
  ownerAuthEmail: "designlab@madebydesignlab.com",

  // Used only by migrate.html to import the old Google Sheets records.
  legacyApiUrl: "https://script.google.com/macros/s/AKfycbxlo1kTf-oLJZw4K2K6id5zneynwjln66f98n6EETF2kySwpta3a45zYT_2K_FJNNXN/exec",

  weekStartsOn: 1, // 1 = Monday, 0 = Sunday
  defaultView: "weekly",
  enableRealtime: true,

  links: {
    dashboard: "./",
    socialMediaPlanner: "https://jndesignlab-cloud.github.io/DesignLabTracker/",
    portfolioViewer: "https://jndesignlab-cloud.github.io/jnbj-designlabcreativestudio/index.html",
    portfolioAdmin: "https://jndesignlab-cloud.github.io/jnbj-designlabcreativestudio/admin.html"
  }
};

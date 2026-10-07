const LIVE_FILE_NAME = "Aqua Super Live Data.json";

function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : "get";
  var result;

  if (action === "get") {
    result = getMaster_();
  } else {
    result = { ok: false, error: "Unknown action" };
  }

  return output_(result, e && e.parameter ? e.parameter.callback : "");
}

function doPost(e) {
  try {
    var p = e && e.parameter ? e.parameter : {};
    var raw = p.data || "";

    if (!raw && e.postData && e.postData.contents) {
      raw = e.postData.contents;
    }

    var body = JSON.parse(raw || "{}");
    var clientDb = body.db;
    var clientRevision = Number(body.revision) || 0;
    var deletedCustomers = body.deletedCustomers || {};
    var deletedEntries = body.deletedEntries || {};

    if (!clientDb ||
        !Array.isArray(clientDb.customers) ||
        !Array.isArray(clientDb.entries)) {
      return output_({
        ok: false,
        error: "Invalid database"
      }, p.callback || "");
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {
      var master = getMaster_();
      var merged = mergeDb_(master.db, clientDb);

      var meta = {
        deletedCustomers: mergeTombstones_(
          master.meta.deletedCustomers,
          deletedCustomers
        ),
        deletedEntries: mergeTombstones_(
          master.meta.deletedEntries,
          deletedEntries
        )
      };

      applyTombstones_(
        merged,
        meta.deletedCustomers,
        meta.deletedEntries
      );

      var next = {
        revision: Number(master.revision || 0) + 1,
        updatedAt: new Date().toISOString(),
        db: ensureIds_(merged),
        meta: meta
      };

      writeMaster_(next);

      return output_({
        ok: true,
        revision: next.revision,
        updatedAt: next.updatedAt,
        db: next.db,
        meta: next.meta,
        clientRevision: clientRevision
      }, p.callback || "");

    } finally {
      lock.releaseLock();
    }

  } catch (err) {
    return output_({
      ok: false,
      error: String(err && err.message || err)
    }, e && e.parameter ? e.parameter.callback : "");
  }
}

function getMaster_() {
  var file = findMaster_();

  if (!file) {
    return {
      revision: 0,
      updatedAt: null,
      db: {
        customers: [],
        entries: []
      },
      meta: {
        deletedCustomers: {},
        deletedEntries: {}
      }
    };
  }

  var text = file.getBlob().getDataAsString() || "{}";
  var obj = JSON.parse(text);

  return {
    revision: Number(obj.revision) || 0,
    updatedAt: obj.updatedAt || null,
    db: ensureIds_(normalize_(obj.db)),
    meta: {
      deletedCustomers:
        obj.meta && obj.meta.deletedCustomers
          ? obj.meta.deletedCustomers
          : {},
      deletedEntries:
        obj.meta && obj.meta.deletedEntries
          ? obj.meta.deletedEntries
          : {}
    }
  };
}

function findMaster_() {
  var files = DriveApp.getFilesByName(LIVE_FILE_NAME);

  if (files.hasNext()) {
    return files.next();
  }

  return null;
}

function writeMaster_(obj) {
  var oldFile = findMaster_();
  var text = JSON.stringify(obj);

  if (oldFile) {
    oldFile.setContent(text);
  } else {
    DriveApp.createFile(
      LIVE_FILE_NAME,
      text,
      MimeType.PLAIN_TEXT
    );
  }
}

function normalize_(db) {
  if (!db || typeof db !== "object") {
    db = {};
  }

  if (!Array.isArray(db.customers)) {
    db.customers = [];
  }

  if (!Array.isArray(db.entries)) {
    db.entries = [];
  }

  return db;
}

function ensureIds_(db) {
  db.customers.forEach(function(c) {
    if (!c.syncId) {
      c.syncId = Utilities.getUuid();
    }
  });

  db.entries.forEach(function(e) {
    if (!e.syncId) {
      e.syncId = Utilities.getUuid();
    }
  });

  return db;
}

function customerKey_(c) {
  if (c && c.syncId) {
    return "id:" + c.syncId;
  }

  return "legacy:" + [
    c && c.name || "",
    c && c.mobile || "",
    c && c.address || ""
  ].join("|").toLowerCase().trim();
}

function entryKey_(e) {
  if (e && e.syncId) {
    return "id:" + e.syncId;
  }

  return "legacy:" + [
    e && e.date || "",
    e && e.name || "",
    e && e.jg || 0,
    e && e.je || 0,
    e && e.cg || 0,
    e && e.ce || 0,
    e && e.amount || 0,
    e && e.paid || 0,
    e && e.previousDue || 0,
    e && e.createdAt || ""
  ].join("|");
}

function mergeDb_(master, client) {
  master = ensureIds_(
    normalize_(JSON.parse(JSON.stringify(master || {})))
  );

  client = ensureIds_(
    normalize_(JSON.parse(JSON.stringify(client || {})))
  );

  var customers = {};
  var entries = {};

  master.customers.forEach(function(c) {
    customers[customerKey_(c)] = c;
  });

  client.customers.forEach(function(c) {
    var key = customerKey_(c);
    var old = customers[key];

    if (!old || newer_(c, old)) {
      customers[key] = c;
    }
  });

  master.entries.forEach(function(e) {
    entries[entryKey_(e)] = e;
  });

  client.entries.forEach(function(e) {
    var key = entryKey_(e);

    if (!entries[key]) {
      entries[key] = e;
    }
  });

  return {
    customers: Object.keys(customers).map(function(key) {
      return customers[key];
    }),
    entries: Object.keys(entries).map(function(key) {
      return entries[key];
    })
  };
}

function newer_(a, b) {
  var ta = Date.parse(a && a.updatedAt || "") || 0;
  var tb = Date.parse(b && b.updatedAt || "") || 0;

  return ta >= tb;
}

function mergeTombstones_(a, b) {
  var out = {};

  Object.keys(a || {}).forEach(function(k) {
    out[k] = a[k];
  });

  Object.keys(b || {}).forEach(function(k) {
    var old = Number(out[k]) || 0;
    var next = Number(b[k]) || 0;

    if (next > old) {
      out[k] = next;
    }
  });

  return out;
}

function applyTombstones_(db, deletedCustomers, deletedEntries) {
  db.customers = db.customers.filter(function(c) {
    var t = Number(deletedCustomers[c.syncId]) || 0;
    var u = Date.parse(c.updatedAt || "") || 0;
    return !t || u > t;
  });

  db.entries = db.entries.filter(function(e) {
    var t = Number(deletedEntries[e.syncId]) || 0;
    var u = Date.parse(
      e.updatedAt || e.createdAt || ""
    ) || 0;
    return !t || u > t;
  });
}

function output_(obj, callback) {
  if (callback) {
    return ContentService
      .createTextOutput(
        callback + "(" + JSON.stringify(obj) + ")"
      )
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}

function getSheet(name){
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

// --- GET ALL MATERIALS ---
function getMaterials(){
  const sh = getSheet('Inventory');
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

// --- GENERATE NEW ITEM ID ---
function generateItemID() {
  return 'ITM-' + Utilities.getUuid().slice(0, 8).toUpperCase();
}

// --- SAVE OR UPDATE ITEM ---
function saveItem(item){
  const sh = getSheet('Inventory');
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf('ItemID');
  let row = -1;

  // Find row by ItemID
  if (item.ItemID) {
    row = data.findIndex((r, idx) => idx > 0 && r[idIndex] == item.ItemID);
  }

  // If new, generate ID and append
  if (row === -1) {
    item.ItemID = generateItemID();
    let rowData = headers.map(h => item[h] || '');
    sh.appendRow(rowData);
    return {success:true, id:item.ItemID};
  } else {
    // Update existing
    let rowData = headers.map(h => item[h] || '');
    sh.getRange(row+1, 1, 1, headers.length).setValues([rowData]);
    return {success:true, id:item.ItemID};
  }
}

// --- DELETE ITEM ---
function deleteItem(id){
  const sh = getSheet('Inventory');
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf('ItemID');
  const row = data.findIndex((r, idx) => idx > 0 && r[idIndex] == id);
  if(row > 0){
    sh.deleteRow(row+1);
    return {success:true};
  }
  return {success:false};
}

// --- SAVE SHIPMENT ---
function saveShipment(ship) {
  const invSh = getSheet('Inventory');
  const shipSh = getSheet('Shipments');

  // Get inventory data and headers
  const invData = invSh.getDataRange().getValues();
  const invHeaders = invData[0];
  const idIndex = invHeaders.indexOf('ItemID');
  const itemIndex = invHeaders.indexOf('Item');
  const qtyIndex = invHeaders.indexOf('Quantity');

  // Find the item row in inventory by ItemID
  const row = invData.findIndex((r, idx) => idx > 0 && r[idIndex] == ship.ShipItem);
  if (row == -1) return { success: false, message: "Item not found in inventory." };

  // Get item name for reference
  const itemName = invData[row][itemIndex];

  // Subtract stock
  let currentQty = Number(invData[row][qtyIndex]) || 0;
  let shipQty = Number(ship.ShipQty) || 0;
  let newQty = currentQty - shipQty;
  if (newQty < 0) newQty = 0;
  invSh.getRange(row + 1, qtyIndex + 1).setValue(newQty);

  // Prepare shipment record
  const newShipment = {
    ShippedID: 'SHP-' + Utilities.getUuid().slice(0, 8).toUpperCase(),
    ShipItem: ship.ShipItem, // ItemID reference
    Item: itemName,
    ShipQty: ship.ShipQty,
    ShipUnit: ship.ShipUnit,
    ShipLocation: ship.ShipLocation,
    NameReceived: ship.NameReceived,
    DateShipped: ship.DateShipped
  };

  // Ensure columns exist in Shipments sheet
  const shipHeaders = shipSh.getDataRange().getValues()[0];
  const rowData = shipHeaders.map(h => newShipment[h] || "");

  shipSh.appendRow(rowData);

  return { success: true, message: "Shipment recorded successfully." };
}

function getShipmentsWithInventory() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shipSh = ss.getSheetByName('Shipments');
  const invSh = ss.getSheetByName('Inventory');

  const shipData = shipSh.getDataRange().getValues();
  const invData = invSh.getDataRange().getValues();

  const shipHeaders = shipData[0];
  const invHeaders = invData[0];

  const shipments = shipData.slice(1).map(r => {
    const obj = Object.fromEntries(shipHeaders.map((h,i)=>[h,r[i]]));
    // ✅ Format DateShipped
    if (obj.DateShipped instanceof Date) {
      obj.DateShipped = Utilities.formatDate(
        obj.DateShipped,
        Session.getScriptTimeZone(),
        "yyyy-MM-dd"
      );
    }
    return obj;
  });

  const inventory = invData.slice(1).map(r =>
    Object.fromEntries(invHeaders.map((h,i)=>[h,r[i]]))
  );

  return { shipments, inventory };
}

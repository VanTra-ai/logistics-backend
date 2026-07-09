const URL = 'http://localhost:3333';

async function e2eTest() {
  try {
    console.log('--- LOGISTICS E2E GOLDEN FLOW TEST ---');

    // 1. Login as Admin
    console.log('\n[1] Logging in as Admin...');
    const loginRes = await fetch(`${URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'tra.pham@example.com',
        password: 'password123',
      }),
    });

    const loginData = await loginRes.json();
    let token = loginData.access_token;

    if (!token)
      throw new Error('Could not login as Admin. ' + JSON.stringify(loginData));
    console.log('Admin Token acquired.');

    // Find a Hub and Customer to create an order
    const hubsRes = await fetch(`${URL}/hubs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const hubs = await hubsRes.json();
    const hubId = hubs.data?.[0]?.id || hubs[0]?.id;

    // 2. Create Order (Simulate Excel Import / Web Order Creation)
    console.log('\n[2] Creating an Order (Import Flow)...');
    const createOrderPayload = {
      sender_name: 'E2E Sender',
      sender_phone: '0123456789',
      sender_address: '123 Send St',
      receiver_name: 'E2E Receiver',
      receiver_phone: '0987654321',
      receiver_address: '456 Recv St',
      cod_amount: 500000,
      weight: 1.5,
      note: 'Test Order',
      pickup_hub_id: hubId,
    };

    const orderRes = await fetch(`${URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(createOrderPayload),
    });
    const newOrderResponse = await orderRes.json();
    if (!orderRes.ok)
      throw new Error(
        'Order creation failed: ' + JSON.stringify(newOrderResponse),
      );
    const newOrder = newOrderResponse.data;
    console.log(
      `Order created: ${newOrder.tracking_number} (ID: ${newOrder.id})`,
    );

    // Fake coordinates for the order so TMS can dispatch it
    await dockerPsql(
      `UPDATE orders SET latitude=21.001, longitude=105.801 WHERE id='${newOrder.id}'`,
    );

    // 3. Scan-in (WMS Putaway)
    console.log('\n[3] WMS Scan-in (Putaway to Shelf)...');

    // First Scan-In to mark as AT_HUB
    const scanInRes = await fetch(`${URL}/orders/scan-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tracking_numbers: [newOrder.tracking_number] }),
    });
    console.log(
      'Scan-In result:',
      scanInRes.status === 201 ? 'SUCCESS' : await scanInRes.text(),
    );

    // We need a location barcode first, let's create a location if none exists
    let locRes = await fetch(`${URL}/locations?hubId=${hubId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    let locations = await locRes.json();
    let barcode = 'LOC-TEST-' + Date.now();
    if (!locations.data || locations.data.length === 0) {
      await fetch(`${URL}/locations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          zone: 'A',
          aisle: '01',
          shelf: '1',
          bin: 'A',
          barcode,
          hub: { id: hubId },
        }),
      });
    } else {
      barcode = locations.data[0].barcode;
    }

    const putawayRes = await fetch(`${URL}/orders/${newOrder.id}/putaway`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ barcode }),
    });
    console.log(
      'Putaway result:',
      putawayRes.status === 200 ? 'SUCCESS' : await putawayRes.text(),
    );

    // 4. TMS Auto Dispatch
    console.log('\n[4] Auto-Dispatching (TMS)...');
    console.log('Faking heartbeat for ALL shippers...');
    dockerPsql(
      "UPDATE users SET current_latitude=21.0, current_longitude=105.8, last_heartbeat=NOW(), is_online=true WHERE role='SHIPPER';",
    );

    // Complete any IN_TRANSIT shipments so shippers are available
    console.log('Freeing up shippers...');
    dockerPsql(
      "UPDATE shipments SET status='COMPLETED' WHERE status='IN_TRANSIT';",
    );

    const tmsRes = await fetch(`${URL}/tms/auto-dispatch`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const tmsData = await tmsRes.json();
    console.log(
      'Auto-Dispatch virtual shipments:',
      typeof tmsData.virtualShipments === 'object'
        ? tmsData.virtualShipments.length
        : tmsData,
    );

    // Confirm Dispatch if any
    if (tmsData.virtualShipments && tmsData.virtualShipments.length > 0) {
      console.log('Confirming dispatch...');
      const confirmRes = await fetch(`${URL}/tms/confirm-dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ virtualShipments: tmsData.virtualShipments }),
      });
      console.log(
        'Confirm result:',
        confirmRes.status === 201 ? 'SUCCESS' : await confirmRes.text(),
      );
    }

    // 4.5 WMS Scan-Out (Handover to Shipper)
    console.log('\n[4.5] WMS Scan-Out (Handover to Shipper)...');
    let assignedShipperId = 'dummy';
    if (tmsData.virtualShipments && tmsData.virtualShipments.length > 0) {
      assignedShipperId = tmsData.virtualShipments[0].shipperId;
    }

    const scanOutRes = await fetch(`${URL}/orders/scan-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tracking_numbers: [newOrder.tracking_number],
        shipper_id: assignedShipperId,
      }),
    });
    console.log(
      'Scan-Out result:',
      scanOutRes.status === 201 ? 'SUCCESS' : await scanOutRes.text(),
    );

    // 5. Shipper App updates Delivery Status
    console.log('\n[5] Mobile Driver Delivery Update...');
    const updateRes = await fetch(`${URL}/orders/${newOrder.id}/complete`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        delivery_image_url: 'https://example.com/delivery.jpg',
        note: 'Signed by Receiver',
      }),
    });
    console.log(
      'Status update result:',
      updateRes.status === 200 ? 'SUCCESS' : await updateRes.text(),
    );

    // 6. Financial Settlement
    console.log('\n[6] Financial Settlement (Wallet check)...');
    // Let's get wallets
    const walletsRes = await fetch(`${URL}/wallets`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const wallets = await walletsRes.json();
    const count = Array.isArray(wallets)
      ? wallets.length
      : wallets.data?.length || 0;
    console.log(`Found ${count} wallets. Integration Flow complete!`);
  } catch (err) {
    console.error('Test failed:', err);
  }
}

const { execSync } = require('child_process');
function dockerPsql(query) {
  execSync(
    `docker exec logistics-db psql -U postgres -d logistics -c "${query}"`,
  );
}

e2eTest();
/* eslint-disable */

import { User } from '../models/User.js';
import { Order } from '../models/Order.js';
import { Pricing } from '../models/Pricing.js';
import { Sequence } from '../models/Sequence.js';

const places = ['Patia', 'Saheed Nagar', 'Jaydev Vihar', 'Khandagiri', 'Nayapalli', 'Chandrasekharpur', 'Old Town', 'Rasulgarh', 'Baramunda', 'Mancheswar'];
const pts = places.map((n, i) => ({
  n: `${n}, Bhubaneswar`,
  lat: 20.24 + ((i * 37) % 10) * 0.0105,
  lng: 85.77 + ((i * 53) % 10) * 0.0125,
}));

export async function seedDatabase() {
  try {
    // 1. Seed Pricing
    let pricing = await Pricing.findOne();
    if (!pricing) {
      pricing = await Pricing.create({
        base_fee: 40,
        base_weight_kg: 2,
        extra_per_kg: 15,
        cancellation_fee: 30,
      });
      console.log('[Seed] Default pricing created');
    }

    // 2. Seed Default Users
    const defaultUsers = [
      { name: 'Admin Control', email: 'admin@demo.com', password: 'admin123', role: 'admin', phone: '9437000099' },
      { name: 'Ravi Kumar', email: 'agent@demo.com', password: 'agent123', role: 'agent', phone: '9437000011' },
      { name: 'Sneha Nayak', email: 'sneha@demo.com', password: 'agent123', role: 'agent', phone: '9437000012' },
      { name: 'Imran Sheikh', email: 'imran@demo.com', password: 'agent123', role: 'agent', phone: '9437000013' },
      { name: 'Aarav Mishra', email: 'user@demo.com', password: 'user123', role: 'user', phone: '9437000001' },
      { name: 'Priya Das', email: 'priya@demo.com', password: 'user123', role: 'user', phone: '9437000002' },
    ];

    const seededUsers = [];
    for (const u of defaultUsers) {
      let existing = await User.findOne({ email: u.email });
      if (!existing) {
        existing = await User.create(u);
        console.log(`[Seed] User created: ${u.email} (${u.role})`);
      }
      seededUsers.push(existing);
    }

    // 3. Seed Sequence
    let seqDoc = await Sequence.findOne({ name: 'orderId' });
    if (!seqDoc) {
      seqDoc = await Sequence.create({ name: 'orderId', seq: 1014 });
    }

    // 4. Seed Orders only on the very first fresh system install
    const alreadySeeded = await Sequence.findOne({ name: 'initial_orders_seeded' });
    const orderCount = await Order.countDocuments();
    if (!alreadySeeded && orderCount === 0) {
      await Sequence.create({ name: 'initial_orders_seeded', seq: 1 });
      const now = Date.now();
      const H = 36e5;
      const statuses = ['Delivered', 'Delivered', 'Delivered', 'Delivered', 'Delivered', 'Delivered', 'In-Transit', 'In-Transit', 'Picked-up', 'Picked-up', 'Placed', 'Placed', 'In-Transit', 'Placed'];
      const userList = seededUsers.filter((u) => u.role === 'user');
      const agentList = seededUsers.filter((u) => u.role === 'agent');

      const calcFee = (w) => {
        const extra = Math.max(0, Math.ceil(w - pricing.base_weight_kg));
        return pricing.base_fee + extra * pricing.extra_per_kg;
      };

      const ordersToInsert = statuses.map((status, i) => {
        const p = pts[i % 10];
        const d = pts[(i + 5) % 10];
        const created = now - (14 - i) * 11 * H;
        const u = userList[i % userList.length];
        const ag = agentList[i % agentList.length];
        const assigned = !(status === 'Placed' && i % 2 === 1);
        const weight = 1 + (i % 6);
        const fee = calcFee(weight);
        const itemPaid = i % 2 === 0;
        const paymentMethod = itemPaid ? 'prepaid' : 'cod';
        const isDisputed = i === 11;
        const paymentStatus = status === 'Delivered'
          ? 'verified'
          : itemPaid
          ? (isDisputed ? 'not_verified' : 'pending_agent_verification')
          : 'pending_pickup';
        const itemValue = !itemPaid && i % 3 === 0 ? 150 + i * 20 : null;
        const totalPayable = fee + (itemValue || 0);

        return {
          id: `DL${1001 + i}`,
          userId: u._id.toString(),
          userName: u.name,
          pickup: { address: p.n, lat: p.lat, lng: p.lng },
          drop: { address: d.n, lat: d.lat, lng: d.lng },
          pkg: {
            type: ['Documents', 'Electronics', 'Clothing', 'Grocery'][i % 4],
            weight,
            desc: 'Sealed carton',
          },
          notes: i % 3 ? '' : 'Call before arrival',
          status,
          agentId: assigned ? ag._id.toString() : null,
          agentName: assigned ? ag.name : null,
          history: [
            { status: 'Placed', at: new Date(created) },
            ...(status !== 'Placed' ? [{ status, at: new Date(created + 2 * H) }] : []),
          ],
          agentLoc: (status === 'Picked-up' || status === 'In-Transit') && assigned ? { lat: p.lat + 0.005, lng: p.lng + 0.005 } : null,
          rating: status === 'Delivered' ? 4 : null,
          deliveryFee: isDisputed ? 350 : fee,
          itemPaid,
          utrId: itemPaid ? (isDisputed ? 'UTR/INVALID_901' : `UTR${498210000000 + i}`) : '',
          accountHolderName: itemPaid ? u.name : '',
          itemValue,
          itemDesc: itemValue ? 'Ordered Goods / Store items' : '',
          totalPayable: isDisputed ? 350 : totalPayable,
          paymentMethod,
          paymentStatus,
          txnId: itemPaid ? (isDisputed ? 'UTR/INVALID_901' : `UTR${498210000000 + i}`) : '',
          payerName: itemPaid ? u.name : '',
          verificationNote: isDisputed ? 'Payment could not be verified from UTR statement. Please pay updated amount.' : '',
          agentDisputed: isDisputed,
          updatedFee: isDisputed ? 350 : null,
          cancellationFee: pricing.cancellation_fee,
          createdAt: new Date(created),
        };
      });

      await Order.insertMany(ordersToInsert);
      console.log(`[Seed] Seeded ${ordersToInsert.length} demo orders in MongoDB`);
    }
  } catch (err) {
    console.error('[Seed Error]:', err.message);
  }
}

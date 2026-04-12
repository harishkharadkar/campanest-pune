import React from 'react';

type EmergencyItem = {
  icon: string;
  title: string;
  number: string;
  mapLink?: string;
};

type EmergencyGroup = {
  title: string;
  items: EmergencyItem[];
};

const groups: EmergencyGroup[] = [
  {
    title: 'Emergency',
    items: [
      { icon: '🚨', title: 'National Emergency', number: '112' },
      { icon: '🚓', title: 'Police', number: '100' },
      { icon: '🚑', title: 'Ambulance', number: '102' },
      { icon: '🔥', title: 'Fire Brigade', number: '101' }
    ]
  },
  {
    title: 'Safety',
    items: [
      { icon: '👩', title: 'Women Helpline', number: '1091' },
      { icon: '🧒', title: 'Child Helpline', number: '1098' },
      { icon: '🚫', title: 'Cyber Crime', number: '1930' },
      { icon: '🧍', title: 'Senior Citizen', number: '14567' }
    ]
  },
  {
    title: 'Health',
    items: [
      { icon: '🧠', title: 'Mental Health (Kiran)', number: '18005990019' },
      { icon: '🏥', title: 'Hospitals', number: '102', mapLink: 'https://www.google.com/maps/search/hospitals+near+me' },
      { icon: '💊', title: 'Medical Stores', number: '102', mapLink: 'https://www.google.com/maps/search/medical+store+near+me' }
    ]
  },
  {
    title: 'Transport',
    items: [
      { icon: '🚗', title: 'Road Accident', number: '1073' },
      { icon: '🚓', title: 'Police Stations', number: '100', mapLink: 'https://www.google.com/maps/search/police+station+near+me' },
      { icon: '🧯', title: 'Fire Stations', number: '101', mapLink: 'https://www.google.com/maps/search/fire+station+near+me' },
      { icon: '🚌', title: 'Bus Stops', number: '1073', mapLink: 'https://www.google.com/maps/search/bus+stand+near+me' }
    ]
  }
];

const openMapLink = (link: string) => {
  window.open(link, '_blank', 'noopener,noreferrer');
};

const callNumber = (number: string) => {
  window.location.href = `tel:${number}`;
};

export default function EmergencyContactsSection() {
  return (
    <section className="card bg-surface border-primary/35 shadow-[0_0_0_1px_rgba(255,122,0,0.08)] space-y-4">
      <div>
        <h2 className="text-lg font-bold">🚨 Emergency Contacts</h2>
        <p className="text-zinc-400 text-sm">Use only in case of real emergency</p>
        <p className="text-[10px] uppercase tracking-wider text-primary/90 mt-2">High Priority Section</p>
      </div>

      <div className="bg-red-600/15 border border-red-500/40 rounded-lg px-3 py-3 space-y-2">
        <p className="text-red-300 text-xs font-semibold leading-relaxed">
          ⚠️ कृपया लक्षात घ्या: ही सुविधा फक्त खऱ्या आपत्कालीन परिस्थितीसाठी आहे. कोणत्याही प्रकारचा
          खोडसाळपणा (prank), चुकीचा वापर किंवा गैरवापर सहन केला जाणार नाही. अशा कृतींसाठी संबंधित व्यक्ती
          स्वतः जबाबदार राहील. CampaNest किंवा अॅप मालक कोणत्याही प्रकारच्या गैरवापरासाठी जबाबदार राहणार
          नाही.
        </p>
        <p className="text-red-200 text-xs font-semibold leading-relaxed">
          ⚠️ Please Note: This feature is strictly for real emergency use only. Any kind of prank, misuse, or false
          alert is not tolerable. The user will be solely responsible for such actions. CampaNest and the app owner
          will not be responsible for any misuse of this feature.
        </p>
      </div>

      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.title} className="space-y-2">
            <h3 className="text-sm font-semibold text-primary">{group.title}</h3>
            <div className="space-y-2">
              {group.items.map((item) => (
                <div key={`${group.title}-${item.title}`} className="bg-[#1E1E1E] border border-zinc-800 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm">{item.icon} {item.title}</p>
                      <p className="text-zinc-400 text-xs mt-1">{item.number}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => callNumber(item.number)}
                      className="bg-primary text-white text-xs font-semibold rounded-lg px-3 py-2"
                    >
                      📞 Call Now
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (item.mapLink) openMapLink(item.mapLink);
                      }}
                      disabled={!item.mapLink}
                      className="bg-zinc-800 text-white text-xs font-semibold rounded-lg px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      🗺 View Location
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

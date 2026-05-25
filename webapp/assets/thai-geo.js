/* =================================================================
   M.E.Tools — Thai address dataset (sample) + default shipping rates
   Structure: province -> ship (default ฿) -> districts -> subdistricts(+zip)
   This is a representative subset (the shop is in Chiang Mai, so the
   north is detailed). Add more in the back office or here as needed.
   ================================================================= */
(function (global) {
  "use strict";
  var GEO = [
    {
      name: "เชียงใหม่", ship: 40,
      districts: [
        { name: "เมืองเชียงใหม่", subs: [
          { name: "ศรีภูมิ", zip: "50200" }, { name: "ช้างคลาน", zip: "50100" },
          { name: "สุเทพ", zip: "50200" }, { name: "ป่าตัน", zip: "50300" } ] },
        { name: "สารภี", subs: [
          { name: "ยางเนิ้ง", zip: "50140" }, { name: "ท่าวังตาล", zip: "50140" },
          { name: "หนองผึ้ง", zip: "50140" } ] },
        { name: "สันทราย", subs: [
          { name: "สันทรายหลวง", zip: "50210" }, { name: "หนองหาร", zip: "50290" } ] },
        { name: "หางดง", subs: [
          { name: "หางดง", zip: "50230" }, { name: "บ้านแหวน", zip: "50230" } ] },
        { name: "สันกำแพง", subs: [
          { name: "สันกำแพง", zip: "50130" }, { name: "ทรายมูล", zip: "50130" } ] },
      ],
    },
    {
      name: "ลำพูน", ship: 55,
      districts: [
        { name: "เมืองลำพูน", subs: [ { name: "ในเมือง", zip: "51000" }, { name: "เวียงยอง", zip: "51000" } ] },
        { name: "ป่าซาง", subs: [ { name: "ปากบ่อง", zip: "51120" }, { name: "ป่าซาง", zip: "51120" } ] },
      ],
    },
    {
      name: "ลำปาง", ship: 65,
      districts: [
        { name: "เมืองลำปาง", subs: [ { name: "เวียงเหนือ", zip: "52000" }, { name: "สบตุ๋ย", zip: "52100" } ] },
        { name: "เกาะคา", subs: [ { name: "ศาลา", zip: "52130" } ] },
      ],
    },
    {
      name: "เชียงราย", ship: 75,
      districts: [
        { name: "เมืองเชียงราย", subs: [ { name: "เวียง", zip: "57000" }, { name: "รอบเวียง", zip: "57000" } ] },
        { name: "แม่สาย", subs: [ { name: "แม่สาย", zip: "57130" }, { name: "เวียงพางคำ", zip: "57130" } ] },
      ],
    },
    {
      name: "กรุงเทพมหานคร", ship: 95,
      districts: [
        { name: "เขตพระนคร", subs: [ { name: "พระบรมมหาราชวัง", zip: "10200" }, { name: "เสาชิงช้า", zip: "10200" } ] },
        { name: "เขตจตุจักร", subs: [ { name: "จตุจักร", zip: "10900" }, { name: "ลาดยาว", zip: "10900" } ] },
        { name: "เขตบางรัก", subs: [ { name: "สีลม", zip: "10500" }, { name: "สุริยวงศ์", zip: "10500" } ] },
      ],
    },
    {
      name: "นนทบุรี", ship: 100,
      districts: [
        { name: "เมืองนนทบุรี", subs: [ { name: "บางกระสอ", zip: "11000" }, { name: "ตลาดขวัญ", zip: "11000" } ] },
        { name: "ปากเกร็ด", subs: [ { name: "ปากเกร็ด", zip: "11120" }, { name: "บางตลาด", zip: "11120" } ] },
      ],
    },
    {
      name: "ขอนแก่น", ship: 120,
      districts: [
        { name: "เมืองขอนแก่น", subs: [ { name: "ในเมือง", zip: "40000" }, { name: "ศิลา", zip: "40000" } ] },
      ],
    },
    {
      name: "ภูเก็ต", ship: 150,
      districts: [
        { name: "เมืองภูเก็ต", subs: [ { name: "ตลาดใหญ่", zip: "83000" }, { name: "ราไวย์", zip: "83130" } ] },
      ],
    },
    {
      name: "สงขลา", ship: 160,
      districts: [
        { name: "หาดใหญ่", subs: [ { name: "หาดใหญ่", zip: "90110" }, { name: "คอหงส์", zip: "90110" } ] },
        { name: "เมืองสงขลา", subs: [ { name: "บ่อยาง", zip: "90000" } ] },
      ],
    },
  ];

  global.THAI_GEO = GEO;

  /* -----------------------------------------------------------------
     Full Thailand dataset loader (all provinces/districts/subdistricts
     /zipcodes). Fetched at runtime from a CDN; falls back to the sample
     above when offline. Result is reshaped to the same nested format.
     ----------------------------------------------------------------- */
  var FULL_URL = "https://cdn.jsdelivr.net/gh/thailand-geography-data/thailand-geography-json@main/src/geography.json";
  global.MEGeoLoad = function () {
    if (global.__MEGEO_CACHE) return Promise.resolve(global.__MEGEO_CACHE);
    if (typeof fetch !== "function") return Promise.resolve(null);
    return fetch(FULL_URL).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (rows) {
      var pmap = {};
      rows.forEach(function (r) {
        var p = r.provinceNameTh, a = r.districtNameTh, d = r.subdistrictNameTh, z = String(r.postalCode || "");
        if (!p || !a || !d) return;
        (pmap[p] = pmap[p] || {});
        (pmap[p][a] = pmap[p][a] || {});
        pmap[p][a][d] = z;
      });
      var th = function (a, b) { return a.localeCompare(b, "th"); };
      var nested = Object.keys(pmap).sort(th).map(function (p) {
        return {
          name: p,
          districts: Object.keys(pmap[p]).sort(th).map(function (a) {
            return {
              name: a,
              subs: Object.keys(pmap[p][a]).sort(th).map(function (d) { return { name: d, zip: pmap[p][a][d] }; }),
            };
          }),
        };
      });
      global.__MEGEO_CACHE = nested;
      return nested;
    }).catch(function () { return null; });
  };
})(window);

import { SortHeader } from './TableControls';

export function OwnListingsTableHeader() {
  return (
    <thead>
      <tr className="border-b border-gray-700 bg-gray-800/60 text-xs font-medium uppercase tracking-wider text-gray-400">
        <th className="w-16 px-3 py-1.5 text-left">Img</th>
        <th className="px-3 py-1.5 text-left">Make / Model</th>
        <th className="px-3 py-1.5 text-left">Title</th>
        <th className="px-3 py-1.5 text-left">
          <SortHeader label="Dealer" sortKey="dealer" />
        </th>
        <th className="px-2 py-1.5 text-center w-14">
          <SortHeader label="Paid" sortKey="ad_status" align="center" />
        </th>
        <th className="pl-1 pr-3 py-1.5 text-right">
          <SortHeader label="Price" sortKey="price" align="right" />
        </th>
        <th className="px-3 py-1.5 text-center">Orig #</th>
        <th className="px-3 py-1.5 text-center">Price #</th>
        <th className="px-3 py-1.5 text-center">VAT</th>
        <th className="px-2 py-1.5 text-center w-14">К</th>
        <th className="px-3 py-1.5 text-right">W</th>
        <th className="px-3 py-1.5 text-right">
          <SortHeader label="Views" sortKey="views" align="right" />
        </th>
        <th className="px-3 py-1.5 text-right">
          <SortHeader label="Last Edit" sortKey="last_edit" align="right" />
        </th>
        <th className="px-3 py-1.5 text-right">
          <SortHeader
            label="cars.bg created"
            sortKey="carsbg_created_date"
            align="right"
          />
        </th>
        <th className="px-2 py-1.5 text-center w-12">New</th>
        <th className="px-3 py-1.5 text-right">
          <SortHeader label="Year" sortKey="reg_year" align="right" />
        </th>
        <th className="px-3 py-1.5 text-center">Body Type</th>
        <th className="px-3 py-1.5 text-center">
          <SortHeader label="Fuel" sortKey="fuel" align="center" />
        </th>
        <th className="px-3 py-1.5 text-right">
          <SortHeader label="KM" sortKey="mileage" align="right" />
        </th>
      </tr>
    </thead>
  );
}

import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB, getDB, autoSave } from '../src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Main function
async function main() {
  // Initialize database
  await connectDB();

  // Read Excel file
  const excelPath = path.join(__dirname, '../data/لیست مراکز استان ها.xlsx');
  const workbook = XLSX.readFile(excelPath);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(worksheet);

  // Map province names to responsible personnel names
  const provinceToResponsibleMap = {};

  data.forEach(row => {
    const province = row['استان'];
    const responsible = row['مسئول'];
    
    if (province && responsible) {
      // If province has multiple responsibles, use the first one
      if (!provinceToResponsibleMap[province]) {
        provinceToResponsibleMap[province] = responsible;
      }
    }
  });

  console.log('Province to Responsible mapping:');
  Object.keys(provinceToResponsibleMap).sort().forEach(province => {
    console.log(`${province}: ${provinceToResponsibleMap[province]}`);
  });

  // Get database
  const db = getDB();

  // Get all personnel to map names to IDs
  const personnelResult = db.exec('SELECT id, name FROM personnel');
  const personnel = {};
  const personnelNameMap = {}; // For fuzzy matching
  
  if (personnelResult.length > 0 && personnelResult[0].values.length > 0) {
    personnelResult[0].values.forEach(row => {
      const id = row[0];
      const name = row[1];
      personnel[name] = id; // name -> id
      
      // Create fuzzy matching map (last name only)
      const nameParts = name.split(' ');
      if (nameParts.length > 0) {
        const lastName = nameParts[nameParts.length - 1];
        personnelNameMap[lastName] = id;
      }
    });
  }

  console.log('\nPersonnel mapping:');
  Object.keys(personnel).forEach(name => {
    console.log(`${name}: ID ${personnel[name]}`);
  });
  
  // Helper function to find personnel ID by name (exact or fuzzy)
  const findPersonnelId = (responsibleName) => {
    // Try exact match first
    if (personnel[responsibleName]) {
      return personnel[responsibleName];
    }
    
    // Try fuzzy match (last name)
    const nameParts = responsibleName.split(' ');
    if (nameParts.length > 0) {
      const lastName = nameParts[nameParts.length - 1];
      if (personnelNameMap[lastName]) {
        return personnelNameMap[lastName];
      }
    }
    
    // Try partial match
    for (const [name, id] of Object.entries(personnel)) {
      if (name.includes(responsibleName) || responsibleName.includes(name)) {
        return id;
      }
    }
    
    return null;
  };

  // Update centers based on province
  let updated = 0;
  let notFound = 0;
  let noPersonnel = 0;

  Object.keys(provinceToResponsibleMap).forEach(province => {
    const responsibleName = provinceToResponsibleMap[province];
    const responsibleId = findPersonnelId(responsibleName);
    
    if (!responsibleId) {
      console.log(`\n⚠️  Personnel not found: ${responsibleName} for province ${province}`);
      noPersonnel++;
      return;
    }
    
    try {
      // Update centers that have this province but no responsible personnel
      const updateQuery = `
        UPDATE centers 
        SET responsiblePersonnelId = ${responsibleId}
        WHERE province = '${province.replace(/'/g, "''")}' 
        AND (responsiblePersonnelId IS NULL OR responsiblePersonnelId = 0)
      `;
      
      db.run(updateQuery);
      
      // Check how many were updated
      const checkQuery = `
        SELECT COUNT(*) as count 
        FROM centers 
        WHERE province = '${province.replace(/'/g, "''")}' 
        AND responsiblePersonnelId = ${responsibleId}
      `;
      
      const checkResult = db.exec(checkQuery);
      const count = checkResult[0]?.values[0]?.[0] || 0;
      
      console.log(`✓ Updated ${count} centers in ${province} to ${responsibleName} (ID: ${responsibleId})`);
      updated += count;
    } catch (error) {
      console.error(`✗ Error updating province ${province}:`, error.message);
      notFound++;
    }
  });

  console.log(`\n\nSummary:`);
  console.log(`- Updated centers: ${updated}`);
  console.log(`- Provinces with no personnel match: ${noPersonnel}`);
  console.log(`- Errors: ${notFound}`);

  // Save database
  autoSave();

  console.log('\n✅ Done!');
}

// Run the script
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

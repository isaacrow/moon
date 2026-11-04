/**
 * Diagnostic Script - Check if New Fields Are Loaded
 * 
 * Run this in your browser console to verify the new fields are available
 */

// Paste this into your browser console when BlueMoon is open:

(async function checkNewFields() {
  console.log('🔍 Checking for new BIBFRAME fields...\n');
  
  try {
    // Import the ontology registry
    const { ONTOLOGY_REGISTRY, getPropertiesByDomain, getCategoriesForDomain } = 
      await import('./src/services/ontologyRegistry.ts');
    
    console.log('✅ Ontology Registry loaded successfully!\n');
    
    // Check Work properties
    const workProps = getPropertiesByDomain('Work');
    console.log(`📚 Total Work properties: ${workProps.length}`);
    
    // Check for new fields
    const newFields = {
      'bf:dissertation': workProps.find(p => p.shortName === 'bf:dissertation'),
      'bf:originDate': workProps.find(p => p.shortName === 'bf:originDate'),
      'bf:originPlace': workProps.find(p => p.shortName === 'bf:originPlace'),
      'bf:temporalCoverage': workProps.find(p => p.shortName === 'bf:temporalCoverage'),
      'bf:accessibilityContent': workProps.find(p => p.shortName === 'bf:accessibilityContent'),
      'bf:notation': workProps.find(p => p.shortName === 'bf:notation'),
      'bf:governmentPublication': workProps.find(p => p.shortName === 'bf:governmentPublication'),
      'bf:hasSeries': workProps.find(p => p.shortName === 'bf:hasSeries'),
    };
    
    console.log('\n🆕 New Work Fields Status:');
    console.log('─'.repeat(50));
    Object.entries(newFields).forEach(([key, prop]) => {
      if (prop) {
        console.log(`✅ ${key}: "${prop.label}" → ${prop.inputComponent}`);
        console.log(`   Category: ${prop.category}`);
      } else {
        console.log(`❌ ${key}: NOT FOUND`);
      }
    });
    
    // Check Instance properties
    const instanceProps = getPropertiesByDomain('Instance');
    console.log(`\n📦 Total Instance properties: ${instanceProps.length}`);
    
    const newInstanceFields = {
      'bf:projectedProvisionDate': instanceProps.find(p => p.shortName === 'bf:projectedProvisionDate'),
      'bf:acquisitionSource': instanceProps.find(p => p.shortName === 'bf:acquisitionSource'),
      'bf:immediateAcquisition': instanceProps.find(p => p.shortName === 'bf:immediateAcquisition'),
    };
    
    console.log('\n🆕 New Instance Fields Status:');
    console.log('─'.repeat(50));
    Object.entries(newInstanceFields).forEach(([key, prop]) => {
      if (prop) {
        console.log(`✅ ${key}: "${prop.label}" → ${prop.inputComponent}`);
        console.log(`   Category: ${prop.category}`);
      } else {
        console.log(`❌ ${key}: NOT FOUND`);
      }
    });
    
    // Check categories
    const workCategories = getCategoriesForDomain('Work');
    console.log('\n📂 Work Categories:', workCategories);
    
    const newCategories = ['Work Metadata', 'Accessibility', 'Academic Information', 'Subject Access', 'Series Information'];
    console.log('\n🆕 New Categories Status:');
    console.log('─'.repeat(50));
    newCategories.forEach(cat => {
      const found = workCategories.includes(cat);
      console.log(`${found ? '✅' : '❌'} ${cat}`);
    });
    
    console.log('\n📊 Summary:');
    console.log('─'.repeat(50));
    const totalNew = Object.values({...newFields, ...newInstanceFields}).filter(Boolean).length;
    const totalExpected = Object.keys({...newFields, ...newInstanceFields}).length;
    console.log(`Found ${totalNew}/${totalExpected} new fields`);
    
    if (totalNew === totalExpected) {
      console.log('\n🎉 SUCCESS! All new fields are loaded correctly!');
      console.log('\n📍 To see them in BlueMoon:');
      console.log('   1. Expand the Work section');
      console.log('   2. Scroll down to find these categories:');
      console.log('      - Work Metadata');
      console.log('      - Accessibility');
      console.log('      - Academic Information');
      console.log('   3. Click category headers to expand them');
    } else {
      console.log('\n⚠️ WARNING: Some fields are missing!');
      console.log('   Try hard-refreshing the page (Ctrl+Shift+R)');
    }
    
  } catch (error) {
    console.error('❌ Error loading ontology registry:', error);
    console.log('\n💡 Make sure you are:');
    console.log('   1. On a page where BlueMoon is loaded');
    console.log('   2. The development server is running');
    console.log('   3. The files were saved correctly');
  }
})();

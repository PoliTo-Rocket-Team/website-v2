import { uploadFileWithType } from "@/utils/r2";
import { NextRequest, NextResponse } from "next/server";

// Sample PDF content (minimal valid PDF)
const SAMPLE_PDF_CONTENT = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Sample Application File) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000265 00000 n 
0000000359 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
444
%%EOF`;

// Files to seed based on the seed.sql data
const SEED_FILES = [
  // Position 1: Full-Stack Developer
  {
    r2Key: "applications/chiara_cv_hash123.pdf",
    fileName: "chiara_cv.pdf",
    content: SAMPLE_PDF_CONTENT.replace(
      "Sample Application File",
      "Chiara Verdi - CV (Full-Stack Developer)"
    ),
  },
  {
    r2Key: "applications/chiara_ml_hash456.pdf",
    fileName: "chiara_ml.pdf",
    content: SAMPLE_PDF_CONTENT.replace(
      "Sample Application File",
      "Chiara Verdi - Motivation Letter"
    ),
  },

  // Position 2: Graphic Designer
  {
    r2Key: "applications/lorenzo_graphic_cv_hash789.pdf",
    fileName: "lorenzo_graphic_cv.pdf",
    content: SAMPLE_PDF_CONTENT.replace(
      "Sample Application File",
      "Lorenzo Bruno - CV (Graphic Designer)"
    ),
  },
  {
    r2Key: "applications/lorenzo_graphic_ml_hash101.pdf",
    fileName: "lorenzo_graphic_ml.pdf",
    content: SAMPLE_PDF_CONTENT.replace(
      "Sample Application File",
      "Lorenzo Bruno - Motivation Letter"
    ),
  },
  {
    r2Key: "applications/martina_photo_cv_hash102.pdf",
    fileName: "martina_photo_cv.pdf",
    content: SAMPLE_PDF_CONTENT.replace(
      "Sample Application File",
      "Martina Bianchi - CV (Graphic Designer)"
    ),
  },
  {
    r2Key: "applications/martina_photo_ml_hash103.pdf",
    fileName: "martina_photo_ml.pdf",
    content: SAMPLE_PDF_CONTENT.replace(
      "Sample Application File",
      "Martina Bianchi - Motivation Letter"
    ),
  },

  // Position 3: Photographer & Videomaker
  {
    r2Key: "applications/federico_photo_cv_hash104.pdf",
    fileName: "federico_photo_cv.pdf",
    content: SAMPLE_PDF_CONTENT.replace(
      "Sample Application File",
      "Federico Neri - CV (Photographer & Videomaker)"
    ),
  },
  {
    r2Key: "applications/federico_photo_ml_hash105.pdf",
    fileName: "federico_photo_ml.pdf",
    content: SAMPLE_PDF_CONTENT.replace(
      "Sample Application File",
      "Federico Neri - Motivation Letter"
    ),
  },

  // Position 4: Social Media Manager
  {
    r2Key: "applications/alice_social_cv_hash106.pdf",
    fileName: "alice_social_cv.pdf",
    content: SAMPLE_PDF_CONTENT.replace(
      "Sample Application File",
      "Alice Rossi - CV (Social Media Manager)"
    ),
  },
  {
    r2Key: "applications/alice_social_ml_hash107.pdf",
    fileName: "alice_social_ml.pdf",
    content: SAMPLE_PDF_CONTENT.replace(
      "Sample Application File",
      "Alice Rossi - Motivation Letter"
    ),
  },

  // Position 5: Sponsoring Specialist
  {
    r2Key: "applications/giovanni_sponsor_cv_hash108.pdf",
    fileName: "giovanni_sponsor_cv.pdf",
    content: SAMPLE_PDF_CONTENT.replace(
      "Sample Application File",
      "Giovanni Villa - CV (Sponsoring Specialist)"
    ),
  },

  // Position 9: Embedded Software Engineer
  {
    r2Key: "applications/nicolo_embedded_cv_hash109.pdf",
    fileName: "nicolo_embedded_cv.pdf",
    content: SAMPLE_PDF_CONTENT.replace(
      "Sample Application File",
      "Nicolò Mancini - CV (Embedded Software Engineer)"
    ),
  },
  {
    r2Key: "applications/ahmed_embedded_cv_hash110.pdf",
    fileName: "ahmed_embedded_cv.pdf",
    content: SAMPLE_PDF_CONTENT.replace(
      "Sample Application File",
      "Ahmed Hassan - CV (Embedded Software Engineer)"
    ),
  },

  // Position 10: Desktop Application Developer
  {
    r2Key: "applications/camilla_desktop_cv_hash111.pdf",
    fileName: "camilla_desktop_cv.pdf",
    content: SAMPLE_PDF_CONTENT.replace(
      "Sample Application File",
      "Camilla Fabbri - CV (Desktop Application Developer)"
    ),
  },

  // Position 11: RF Specialist
  {
    r2Key: "applications/riccardo_rf_cv_hash112.pdf",
    fileName: "riccardo_rf_cv.pdf",
    content: SAMPLE_PDF_CONTENT.replace(
      "Sample Application File",
      "Riccardo Monti - CV (RF Specialist)"
    ),
  },

  // Position 12: Hardware Engineer
  {
    r2Key: "applications/anna_hardware_cv_hash113.pdf",
    fileName: "anna_hardware_cv.pdf",
    content: SAMPLE_PDF_CONTENT.replace(
      "Sample Application File",
      "Anna Lucchesi - CV (Hardware Engineer)"
    ),
  },

  // Position 13: Control System Engineer
  {
    r2Key: "applications/manuel_control_cv_hash114.pdf",
    fileName: "manuel_control_cv.pdf",
    content: SAMPLE_PDF_CONTENT.replace(
      "Sample Application File",
      "Manuel Testa - CV (Control System Engineer)"
    ),
  },

  // Position 14: Recovery Engineer
  {
    r2Key: "applications/jessica_recovery_cv_hash115.pdf",
    fileName: "jessica_recovery_cv.pdf",
    content: SAMPLE_PDF_CONTENT.replace(
      "Sample Application File",
      "Jessica Orlando - CV (Recovery Engineer)"
    ),
  },

  // Position 15: Mission Analyst
  {
    r2Key: "applications/antonio_mission_cv_hash116.pdf",
    fileName: "antonio_mission_cv.pdf",
    content: SAMPLE_PDF_CONTENT.replace(
      "Sample Application File",
      "Antonio Marchetti - CV (Mission Analyst)"
    ),
  },

  // Position 16: Software Engineer (Mission Analysis)
  {
    r2Key: "applications/chiara_software_cv_hash117.pdf",
    fileName: "chiara_software_cv.pdf",
    content: SAMPLE_PDF_CONTENT.replace(
      "Sample Application File",
      "Chiara Milani - CV (Software Engineer)"
    ),
  },

  // Position 17: Design & Manufacturing Engineer
  {
    r2Key: "applications/marco_design_cv_hash118.pdf",
    fileName: "marco_design_cv.pdf",
    content: SAMPLE_PDF_CONTENT.replace(
      "Sample Application File",
      "Marco Bernardi - CV (Design & Manufacturing Engineer)"
    ),
  },

  // Position 18: Structural Engineer
  {
    r2Key: "applications/elena_structural_cv_hash119.pdf",
    fileName: "elena_structural_cv.pdf",
    content: SAMPLE_PDF_CONTENT.replace(
      "Sample Application File",
      "Elena Barone - CV (Structural Engineer)"
    ),
  },

  // Position 19: Feed System Engineer
  {
    r2Key: "applications/luca_feed_cv_hash120.pdf",
    fileName: "luca_feed_cv.pdf",
    content: SAMPLE_PDF_CONTENT.replace(
      "Sample Application File",
      "Luca Fiore - CV (Feed System Engineer)"
    ),
  },
  {
    r2Key: "applications/sofia_bianchi_cv_hash121.pdf",
    fileName: "sofia_bianchi_cv.pdf",
    content: SAMPLE_PDF_CONTENT.replace(
      "Sample Application File",
      "Sofia Bianchi - CV (Feed System Engineer)"
    ),
  },

  // Position 20: Test Engineer (Propulsion)
  {
    r2Key: "applications/sofia_test_cv_hash122.pdf",
    fileName: "sofia_test_cv.pdf",
    content: SAMPLE_PDF_CONTENT.replace(
      "Sample Application File",
      "Sofia Colombo - CV (Test Engineer - Propulsion)"
    ),
  },

  // Position 21: Test Engineer (Thrust Chamber)
  {
    r2Key: "applications/matteo_thrust_cv_hash123.pdf",
    fileName: "matteo_thrust_cv.pdf",
    content: SAMPLE_PDF_CONTENT.replace(
      "Sample Application File",
      "Matteo Leone - CV (Test Engineer - Thrust Chamber)"
    ),
  },

  // Position 22: Propulsion Engineer
  {
    r2Key: "applications/giulia_propulsion_cv_hash124.pdf",
    fileName: "giulia_propulsion_cv.pdf",
    content: SAMPLE_PDF_CONTENT.replace(
      "Sample Application File",
      "Giulia Ferri - CV (Propulsion Engineer)"
    ),
  },
  {
    r2Key: "applications/marco_rossi_cv_hash125.pdf",
    fileName: "marco_rossi_cv.pdf",
    content: SAMPLE_PDF_CONTENT.replace(
      "Sample Application File",
      "Marco Rossi - CV (Propulsion Engineer)"
    ),
  },
];

export async function POST(request: NextRequest) {
  try {
    console.log("🪣 Starting R2 bucket seeding...");

    let uploadedCount = 0;
    let errorCount = 0;
    const results = [];

    for (const file of SEED_FILES) {
      try {
        console.log(`📄 Uploading ${file.fileName}...`);

        // Upload to R2
        const fileBuffer = Buffer.from(file.content, "utf-8");
        await uploadFileWithType(fileBuffer, file.r2Key, "application/pdf");

        console.log(`✅ Uploaded ${file.fileName} to ${file.r2Key}`);
        uploadedCount++;
        results.push({
          file: file.fileName,
          r2Key: file.r2Key,
          status: "success",
        });
      } catch (error) {
        console.error(`❌ Failed to upload ${file.fileName}:`, error);
        errorCount++;
        results.push({
          file: file.fileName,
          r2Key: file.r2Key,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.log(`\n🎉 Bucket seeding complete!`);
    console.log(`✅ Successfully uploaded: ${uploadedCount} files`);
    if (errorCount > 0) {
      console.log(`❌ Failed uploads: ${errorCount} files`);
    }

    return NextResponse.json({
      success: true,
      message: "R2 bucket seeding completed",
      stats: {
        totalFiles: SEED_FILES.length,
        uploaded: uploadedCount,
        errors: errorCount,
      },
      results,
    });
  } catch (error) {
    console.error("❌ R2 bucket seeding failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

class MegaScraper {
    constructor() {
        // DotNotes configuration
        this.dotnotesBaseUrl = 'https://api.dotnotes.in';
        
        // FifteenForteen configuration
        this.fifteenforteenBaseUrl = 'https://fifteenforteen.vercel.app';
        
        // SyllabusX configuration
        this.syllabusxBaseUrl = 'https://server.syllabusx.live';
        
        // Shared configuration - SINGLE TARGET DIRECTORY
        this.materialsDir = path.resolve('../material');
        
        // DotNotes branch IDs (MASTER BRANCH STRUCTURE)
        this.dotNotesBranches = {
            'AIDS': '1fH0uvhnXRsshqiDzHlR3WF2LVC7PfnQ7',
            'AIML': '13moTd7MZzBiAl-0xdUHEtF-xlV_OwlLz',
            'CIVIL': '1_OLVAfJQldM4F1F0QU9PBLL0gWXhnv66',
            'CSE': '12fczfGql33ZZH9LSFgxcrrOuIAKEzjdh',
            'ECE': '1Yo-MxG6locQ4lMKl07CN8lwqvnu-cWt3',
            'EEE': '1N-0kK34Qqme71MlznsslSE-RhiAaWRM1',
            'IT': '1u0nTa0WLf58jZ42zuLS7anUb7d_Nj99p',
            'MECH': '1XLxDgD7iJCbWZx7JbcuRDAfg2NPitVGV'
        };

        // SyllabusX to DotNotes branch mapping
        this.syllabusxBranchMapping = {
            'CSE': 'CSE',     // Direct match
            'IT': 'IT',       // Direct match  
            'CST': 'CSE',     // Computer Science & Technology → CSE
            'ITE': 'IT',      // Information Technology & Engineering → IT
            'ECE': 'ECE',     // Direct match
            'EE': 'EEE',      // Electrical Engineering → EEE
            'EEE': 'EEE',     // Direct match
            'ICE': 'ECE',     // Instrumentation & Control → ECE
            'ME': 'MECH',     // Mechanical Engineering → MECH
            'CE': 'CIVIL',    // Civil Engineering → CIVIL
            'MAE': 'MECH'     // Mechanical & Automation → MECH
        };

        // SyllabusX semesters
        this.syllabusxSemesters = [
            { value: "firstsemesters", label: "1" },
            { value: "secondsemesters", label: "2" },
            { value: "thirdsemesters", label: "3" },
            { value: "fourthsemesters", label: "4" },
            { value: "fifthsemesters", label: "5" },
            { value: "sixthsemesters", label: "6" },
            { value: "seventhsemesters", label: "7" }
        ];

        // SyllabusX branches (original names for API calls)
        this.syllabusxBranches = [
            { value: "CSE", label: "CSE" },
            { value: "IT", label: "IT" },
            { value: "CST", label: "CST" },
            { value: "ITE", label: "ITE" },
            { value: "ECE", label: "ECE" },
            { value: "EE", label: "EE" },
            { value: "EEE", label: "EEE" },
            { value: "ICE", label: "ICE" },
            { value: "ME", label: "ME" },
            { value: "CE", label: "CE" },
            { value: "MAE", label: "MAE" }
        ];

        // SyllabusX material types
        this.syllabusxMaterialTypes = ['notes', 'pyq', 'books', 'practicalfile'];

        this.stats = {
            totalFiles: 2131, // DotNotes expected files
            downloadedFiles: 0,
            skippedFiles: 0,
            errorFiles: 0,
            errors: [],
            startTime: new Date().toISOString(),
            dotnotesFiles: 0,
            fifteenforteenFiles: 0,
            syllabusxFiles: 0
        };
        
        this.commonSemestersDownloaded = false;
    }

    async makeRequest(url, maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await axios.get(url, { 
                    timeout: 15000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });                await new Promise(resolve => setTimeout(resolve, 12));
                return response.data;
            } catch (error) {
                if (i === maxRetries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, 250 * (i + 1)));
            }
        }
    }

    // =================================================================
    // UNIVERSAL FILE DOWNLOAD METHODS
    // =================================================================

    async downloadDotNotesFile(downloadUrl, filePath, fileName) {
        try {
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                if (stats.size > 100) {
                    this.stats.skippedFiles++;
                    return true;
                }
            }

            const response = await axios.get(downloadUrl, {
                responseType: 'stream',
                timeout: 60000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            fs.mkdirSync(path.dirname(filePath), { recursive: true });

            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    const size = fs.statSync(filePath).size;
                    const sizeStr = this.formatFileSize(size);
                    console.log(`          ✅ DN: ${fileName} (${sizeStr})`);
                    this.stats.downloadedFiles++;
                    this.stats.dotnotesFiles++;
                    this.printProgress();
                    resolve(true);
                });
                writer.on('error', reject);
            });
        } catch (error) {
            console.log(`          ❌ DN Failed ${fileName}: ${error.message}`);
            this.stats.errorFiles++;
            this.stats.errors.push({ source: 'DotNotes', fileName, error: error.message });
            return false;
        }
    }

    async downloadFifteenForteenFile(driveUrl, filePath, fileName) {
        try {
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                if (stats.size > 100) {
                    this.stats.skippedFiles++;
                    return true;
                }
            }

            const fileId = this.extractFileIdFromDriveUrl(driveUrl);
            if (!fileId) {
                console.log(`          ❌ FFT Invalid drive URL: ${driveUrl}`);
                this.stats.errorFiles++;
                return false;
            }

            const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

            const response = await axios.get(downloadUrl, {
                responseType: 'stream',
                timeout: 60000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            fs.mkdirSync(path.dirname(filePath), { recursive: true });

            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    const size = fs.statSync(filePath).size;
                    const sizeStr = this.formatFileSize(size);
                    console.log(`          ✅ FFT: ${fileName} (${sizeStr})`);
                    this.stats.downloadedFiles++;
                    this.stats.fifteenforteenFiles++;
                    this.printProgress();
                    resolve(true);
                });
                writer.on('error', reject);
            });
        } catch (error) {
            console.log(`          ❌ FFT Failed ${fileName}: ${error.message}`);
            this.stats.errorFiles++;
            this.stats.errors.push({ source: 'FifteenForteen', fileName, error: error.message });
            return false;
        }
    }

    async downloadSyllabusXFile(downloadUrl, filePath, fileName) {
        try {
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                if (stats.size > 100) {
                    this.stats.skippedFiles++;
                    return true;
                }
            }

            const response = await axios.get(downloadUrl, {
                responseType: 'stream',
                timeout: 60000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            fs.mkdirSync(path.dirname(filePath), { recursive: true });

            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    const size = fs.statSync(filePath).size;
                    const sizeStr = this.formatFileSize(size);
                    console.log(`          ✅ SX: ${fileName} (${sizeStr})`);
                    this.stats.downloadedFiles++;
                    this.stats.syllabusxFiles++;
                    this.printProgress();
                    resolve(true);
                });
                writer.on('error', reject);
            });
        } catch (error) {
            console.log(`          ❌ SX Failed ${fileName}: ${error.message}`);
            this.stats.errorFiles++;
            this.stats.errors.push({ source: 'SyllabusX', fileName, error: error.message });
            return false;
        }
    }

    // =================================================================
    // UTILITY METHODS
    // =================================================================

    extractFileIdFromDriveUrl(url) {
        const patterns = [
            /\/file\/d\/([a-zA-Z0-9-_]+)/,
            /id=([a-zA-Z0-9-_]+)/,
            /\/([a-zA-Z0-9-_]+)\/view/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    printProgress() {
        const total = this.stats.downloadedFiles + this.stats.skippedFiles;
        const percent = ((total / this.stats.totalFiles) * 100).toFixed(1);
        if (total % 10 === 0) {
            console.log(`   📊 Progress: ${total}/${this.stats.totalFiles} (${percent}%) | DN: ${this.stats.dotnotesFiles} | FFT: ${this.stats.fifteenforteenFiles} | SX: ${this.stats.syllabusxFiles} | Skipped: ${this.stats.skippedFiles}`);
        }
    }

    sanitizeFileName(name) {
        return name
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\s+/g, '_')
            .substring(0, 200);
    }

    // =================================================================
    // PHASE 1: DOTNOTES METHODS
    // =================================================================

    async downloadAllDotNotesFiles() {
        console.log('🎯 PHASE 1: STARTING DOTNOTES DOWNLOAD...');
        
        for (const [branchName, branchId] of Object.entries(this.dotNotesBranches)) {
            console.log(`\n🎯 PROCESSING ${branchName} BRANCH...`);
            
            try {
                const semesters = await this.makeRequest(`${this.dotnotesBaseUrl}/getChild?id=${branchId}`);
                console.log(`   📊 Found ${semesters.length} semesters`);
                
                for (const semester of semesters) {
                    const semName = semester.name.toUpperCase();
                    
                    if (semName === 'SEM1' || semName === 'SEM2') {
                        if (!this.commonSemestersDownloaded) {
                            console.log(`\n   📚 ${semName} (COMMON)...`);
                            await this.downloadDotNotesSemesterFiles(semester, 'COMMON');
                        } else {
                            console.log(`   ⏭️  Skipping ${semName} (already in COMMON)`);
                        }
                        continue;
                    }
                    
                    console.log(`\n   📚 ${semName}...`);
                    await this.downloadDotNotesSemesterFiles(semester, branchName);
                }
                
                if (!this.commonSemestersDownloaded) {
                    this.commonSemestersDownloaded = true;
                }
                
                console.log(`\n✅ COMPLETED ${branchName}!`);
                
            } catch (error) {
                console.log(`   ❌ FAILED ${branchName}: ${error.message}`);
            }
        }
    }

    async downloadDotNotesSemesterFiles(semester, branchName) {
        try {
            const subjects = await this.makeRequest(`${this.dotnotesBaseUrl}/getChild?id=${semester.id}`);
            
            for (const subject of subjects) {
                console.log(`\n       📖 ${subject.name}`);
                
                const folders = await this.makeRequest(`${this.dotnotesBaseUrl}/getChild?id=${subject.id}`);
                
                for (const folder of folders) {
                    console.log(`         📁 ${folder.name}`);
                    
                    const files = await this.makeRequest(`${this.dotnotesBaseUrl}/getFiles?id=${folder.id}`);
                    
                    if (files.length === 0) continue;
                    
                    const folderPath = path.join(
                        this.materialsDir,
                        branchName,
                        semester.name.toUpperCase(),
                        subject.name,
                        folder.name
                    );

                    for (const file of files) {
                        if (!file.url_download) continue;
                        
                        const sanitizedName = 'DN_' + this.sanitizeFileName(file.name);
                        const filePath = path.join(folderPath, sanitizedName);
                          await this.downloadDotNotesFile(file.url_download, filePath, `DN_${file.name}`);
                        await new Promise(resolve => setTimeout(resolve, 9));
                    }
                }
            }
        } catch (error) {
            console.log(`     ❌ Error in ${semester.name}: ${error.message}`);
        }
    }

    // =================================================================
    // PHASE 2: FIFTEENFORTEEN METHODS  
    // =================================================================

    async downloadAllFifteenForteenFiles() {
        console.log('\n🎯 PHASE 2: STARTING FIFTEENFORTEEN DOWNLOAD (First Year Supplement)...');
        
        try {
            const subjects = await this.scrapeFifteenForteenContentPage();
            
            for (const subject of subjects) {
                const driveLinks = await this.scrapeFifteenForteenSubjectPage(subject);
                
                if (driveLinks.length > 0) {
                    this.stats.totalFiles += driveLinks.length;
                    await this.downloadFifteenForteenSubjectFiles(subject, driveLinks);                }
                
                await new Promise(resolve => setTimeout(resolve, 250));
            }
            
        } catch (error) {
            console.error(`💥 FIFTEENFORTEEN ERROR: ${error.message}`);
        }
    }

    async scrapeFifteenForteenContentPage() {
        console.log('   🔍 Scraping FifteenForteen content page...');
        
        const html = await this.makeRequest(`${this.fifteenforteenBaseUrl}/html/content.html`);
        const dom = new JSDOM(html);
        const document = dom.window.document;
        
        const subjectLinks = [];
        const links = document.querySelectorAll('a[href*="contents"]');
        
        for (const link of links) {
            const href = link.getAttribute('href');
            const name = link.textContent.trim();
            
            if (href && name && href.includes('.html') && !href.includes('content.html')) {
                const fullUrl = href.startsWith('http') ? href : `${this.fifteenforteenBaseUrl}/html/${href}`;
                subjectLinks.push({
                    name: name,
                    url: fullUrl
                });
            }
        }
        
        console.log(`   📚 Found ${subjectLinks.length} valid subject links`);
        return subjectLinks;
    }

    async scrapeFifteenForteenSubjectPage(subject) {
        console.log(`\n   📖 Processing FFT ${subject.name}...`);
        
        try {
            const html = await this.makeRequest(subject.url);
            const dom = new JSDOM(html);
            const document = dom.window.document;
            
            const driveLinks = [];
            const allLinks = document.querySelectorAll('a[href*="drive.google.com"]');
            
            for (const link of allLinks) {
                const href = link.getAttribute('href');
                const linkText = link.textContent.trim();
                
                if (href && linkText) {
                    driveLinks.push({
                        url: href,
                        name: linkText
                    });
                }
            }
            
            console.log(`     📁 Found ${driveLinks.length} drive links`);
            return driveLinks;
            
        } catch (error) {
            console.log(`     ❌ Error processing FFT ${subject.name}: ${error.message}`);
            return [];
        }
    }

    async downloadFifteenForteenSubjectFiles(subject, driveLinks) {
        // Use DotNotes structure: COMMON/SEM1 or COMMON/SEM2/Subject/Folder
        const subjectDir = path.join(this.materialsDir, 'COMMON', 'SEM1', this.sanitizeFileName(subject.name));
        
        for (const link of driveLinks) {
            const linkTextLower = link.name.toLowerCase();
            const isNote = linkTextLower.includes('note');
            
            let filePath;
            if (isNote) {
                const sanitizedName = 'FFT_' + this.sanitizeFileName(link.name) + '.pdf';
                filePath = path.join(subjectDir, 'Notes', sanitizedName);
            } else {
                const sanitizedName = 'FFT_' + this.sanitizeFileName(link.name) + '.pdf';
                filePath = path.join(subjectDir, 'PYQs', sanitizedName);
            }
              await this.downloadFifteenForteenFile(link.url, filePath, `FFT_${link.name}`);
            await new Promise(resolve => setTimeout(resolve, 125));
        }
    }

    // =================================================================
    // PHASE 3: SYLLABUSX METHODS
    // =================================================================

    async downloadAllSyllabusXFiles() {
        console.log('\n🎯 PHASE 3: STARTING SYLLABUSX DOWNLOAD (Additional Content)...');
        
        try {
            for (const semester of this.syllabusxSemesters) {
                console.log(`\n🎓 PROCESSING SYLLABUSX SEMESTER ${semester.label}...`);
                
                // Handle SEM1 and SEM2 as COMMON
                if (semester.label === '1' || semester.label === '2') {
                    console.log(`\n  📚 SEM${semester.label} (Adding to COMMON)`);
                    await this.processSyllabusXSemester(semester, 'COMMON');
                    continue;
                }
                
                // Process other semesters for each branch  
                for (const sxBranch of this.syllabusxBranches) {
                    const dotNotesBranchName = this.syllabusxBranchMapping[sxBranch.value];
                    if (!dotNotesBranchName) continue; // Skip unmapped branches
                    
                    console.log(`\n  🏢 SX BRANCH: ${sxBranch.label} → ${dotNotesBranchName}`);
                    await this.processSyllabusXSemester(semester, dotNotesBranchName, sxBranch.value);
                }
            }
            
        } catch (error) {
            console.error(`💥 SYLLABUSX ERROR: ${error.message}`);
        }
    }

    async processSyllabusXSemester(semester, targetBranchFolder, sxBranchForAPI = 'CSE') {
        try {
            const subjects = await this.getSyllabusXSubjects(semester.value, sxBranchForAPI);
            console.log(`     📚 Found ${subjects.length} SX subjects`);

            for (const subject of subjects) {
                console.log(`\n     📖 Processing SX: ${subject}`);
                
                const subjectDetails = await this.getSyllabusXSubjectDetails(semester.value, sxBranchForAPI, subject);
                
                if (!subjectDetails) {
                    console.log(`       ⚠️  No SX details found for ${subject}`);
                    continue;
                }

                // Use DotNotes folder structure: Branch/Semester/Subject/Folder/
                const subjectPath = path.join(
                    this.materialsDir,
                    targetBranchFolder,
                    `SEM${semester.label}`,
                    this.sanitizeFileName(subject)
                );

                await this.downloadSyllabusXStudyMaterials(subjectDetails, subjectPath, subject);
            }

        } catch (error) {
            console.log(`     ❌ Error processing SX ${targetBranchFolder} SEM${semester.label}: ${error.message}`);
        }
    }

    async getSyllabusXSubjects(semester, branch) {
        try {
            const url = `${this.syllabusxBaseUrl}/btech/${semester}/${branch}`;
            const subjects = await this.makeRequest(url);
            return Array.isArray(subjects) ? subjects : subjects.split('\n').filter(s => s.trim());
        } catch (error) {
            console.log(`    ❌ Error getting SX subjects for ${branch} ${semester}: ${error.message}`);
            return [];
        }
    }

    async getSyllabusXSubjectDetails(semester, branch, subject) {
        try {
            const formattedSubject = this.formatSyllabusXSubjectName(subject);
            const url = `${this.syllabusxBaseUrl}/btech/${semester}/${branch}/${encodeURIComponent(formattedSubject)}`;
            const details = await this.makeRequest(url);
            return Array.isArray(details) ? details[0] : details;
        } catch (error) {
            console.log(`      ❌ Error getting SX details for ${subject}: ${error.message}`);
            return null;
        }
    }

    formatSyllabusXSubjectName(subject) {
        return subject.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    }

    async downloadSyllabusXStudyMaterials(subjectDetails, subjectPath, subjectName) {
        for (const materialType of this.syllabusxMaterialTypes) {
            let materialId;
            
            switch (materialType) {
                case 'notes':
                    materialId = subjectDetails.book;
                    break;
                case 'pyq':
                    materialId = subjectDetails.pYq;
                    break;
                case 'books':
                    materialId = subjectDetails.book;
                    break;
                case 'practicalfile':
                    materialId = subjectDetails.practical;
                    break;
                default:
                    materialId = subjectDetails[materialType];
            }
            
            if (!materialId) continue;

            await this.processSyllabusXMaterialType(materialId, materialType, subjectPath, subjectName);
        }
    }

    async processSyllabusXMaterialType(materialId, materialType, subjectPath, subjectName) {
        try {
            const materials = await this.getSyllabusXStudyMaterials(materialId, materialType);
            
            if (materials.length === 0) {
                console.log(`        📭 No SX ${materialType} available for ${subjectName}`);
                return;
            }

            console.log(`        📁 SX ${materialType.toUpperCase()} (${materials.length} files)`);

            // Use DotNotes folder structure
            const materialPath = path.join(subjectPath, materialType.toUpperCase());

            for (const material of materials) {
                if (!material.webViewLink) continue;

                const fileId = material.id || this.extractSyllabusXFileIdFromLink(material.webViewLink);
                if (!fileId) continue;

                const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
                const sanitizedName = 'SX_' + this.sanitizeFileName(material.name);
                const filePath = path.join(materialPath, sanitizedName);                await this.downloadSyllabusXFile(downloadUrl, filePath, `SX_${material.name}`);
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        } catch (error) {
            console.log(`        ❌ Error processing SX ${materialType}: ${error.message}`);
        }
    }

    async getSyllabusXStudyMaterials(materialId, materialType) {
        try {
            const url = `${this.syllabusxBaseUrl}/drive/${materialType}/${materialId}`;
            const materials = await this.makeRequest(url);
            return Array.isArray(materials) ? materials : [];
        } catch (error) {
            console.log(`        ❌ Error getting SX ${materialType} for ${materialId}: ${error.message}`);
            return [];
        }
    }

    extractSyllabusXFileIdFromLink(link) {
        const patterns = [
            /\/file\/d\/([a-zA-Z0-9-_]+)/,
            /id=([a-zA-Z0-9-_]+)/,
            /\/d\/([a-zA-Z0-9-_]+)/
        ];

        for (const pattern of patterns) {
            const match = link.match(pattern);
            if (match) return match[1];
        }
        return null;
    }

    // =================================================================
    // MAIN EXECUTION METHOD
    // =================================================================

    async downloadAllFiles() {
        console.log('🚀 MEGA SCRAPER STARTING...');
        console.log('📊 Target: Complete educational material collection');
        console.log('🏗️  Structure: DotNotes folder organization (Branch→Semester→Subject→Folder→Files)');
        console.log('📂 Target Directory: ../material\n');
        
        // Phase 1: Download all DotNotes content (primary source)
        await this.downloadAllDotNotesFiles();
        
        // Phase 2: Download FifteenForteen content (first-year supplement)
        await this.downloadAllFifteenForteenFiles();
        
        // Phase 3: Download SyllabusX content (additional supplement)
        await this.downloadAllSyllabusXFiles();
        
        this.generateReport();
    }

    generateReport() {
        const total = this.stats.downloadedFiles + this.stats.skippedFiles;
        const percent = ((total / this.stats.totalFiles) * 100).toFixed(1);
        
        console.log('\n' + '='.repeat(80));
        console.log('🎉 MEGA SCRAPER COMPLETED!');
        console.log('='.repeat(80));
        console.log(`✅ Total Downloaded: ${this.stats.downloadedFiles} files`);
        console.log(`   📘 DotNotes: ${this.stats.dotnotesFiles} files`);
        console.log(`   📗 FifteenForteen: ${this.stats.fifteenforteenFiles} files`);
        console.log(`   📙 SyllabusX: ${this.stats.syllabusxFiles} files`);
        console.log(`⏭️  Skipped: ${this.stats.skippedFiles} files`);
        console.log(`❌ Errors: ${this.stats.errorFiles} files`);
        console.log(`📊 Total processed: ${total}/${this.stats.totalFiles} (${percent}%)`);
        
        if (this.stats.errorFiles > 0) {
            console.log(`\n⚠️  ${this.stats.errors.length} errors occurred during download:`);
            const dotnotesErrors = this.stats.errors.filter(e => e.source === 'DotNotes').length;
            const fifteenforteenErrors = this.stats.errors.filter(e => e.source === 'FifteenForteen').length;
            const syllabusxErrors = this.stats.errors.filter(e => e.source === 'SyllabusX').length;
            console.log(`   📘 DotNotes errors: ${dotnotesErrors}`);
            console.log(`   📗 FifteenForteen errors: ${fifteenforteenErrors}`);
            console.log(`   📙 SyllabusX errors: ${syllabusxErrors}`);
        }
        
        console.log('\n📁 Final File Organization:');
        console.log('   📂 Branch folders: AIDS, AIML, CIVIL, CSE, ECE, EEE, IT, MECH');
        console.log('   📂 COMMON folder: SEM1-2 content from all sources');
        console.log('   🏷️  Prefixes: DN_ (DotNotes), FFT_ (FifteenForteen), SX_ (SyllabusX)');
        console.log('   🏗️  Structure: Branch→Semester→Subject→Folder→Files');
        console.log('\n📊 Branch Mapping (SyllabusX → DotNotes):');
        console.log('   CSE→CSE, IT→IT, CST→CSE, ITE→IT, ECE→ECE');
        console.log('   EE→EEE, EEE→EEE, ICE→ECE, ME→MECH, CE→CIVIL, MAE→MECH');
    }
}

// Run the mega scraper
const scraper = new MegaScraper();
scraper.downloadAllFiles().catch(error => {
    console.error('💥 ERROR:', error);
    process.exit(1);
});

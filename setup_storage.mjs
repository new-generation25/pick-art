import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupStorage() {
    console.log('📦 Setting up storage bucket...\n');

    try {
        // 기존 버킷 확인
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();

        if (listError) {
            console.error('❌ Error listing buckets:', listError);
            return;
        }

        const bucketExists = buckets.some(bucket => bucket.name === 'event-images');

        if (bucketExists) {
            console.log('✅ Bucket "event-images" already exists');
        } else {
            // 버킷 생성
            const { data, error } = await supabase.storage.createBucket('event-images', {
                public: true, // 공개 버킷으로 설정
                fileSizeLimit: 5242880, // 5MB
                allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
            });

            if (error) {
                console.error('❌ Error creating bucket:', error);
                return;
            }

            console.log('✅ Bucket "event-images" created successfully');
        }

        // 버킷 목록 출력
        console.log('\n📋 Current buckets:');
        buckets.forEach(bucket => {
            console.log(`   - ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
        });

        console.log('\n✅ Storage setup complete!');
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

setupStorage();

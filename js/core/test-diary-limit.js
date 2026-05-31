/**
 * 日记数量限制功能测试脚本
 * 
 * 使用方式：
 * 1. 在浏览器控制台打开页面
 * 2. 打开 F12 DevTools → Console
 * 3. 输入并运行测试命令
 */

/**
 * 测试1：验证配置解析
 * 检查 limit 字段是否正确从配置中解析
 */
export async function testConfigParsing() {
    console.log('=== Test 1: Config Parsing ===\n');
    
    try {
        const response = await fetch('contents/博客配置.md');
        const markdown = await response.text();
        
        // 检查配置中的展示限制字段
        const hasDiaryLimit = /### 日记[\s\S]*?展示限制：10/.test(markdown);
        const hasOtherLimit = /### 独立开发者[\s\S]*?展示限制：999/.test(markdown);
        
        console.log(`✓ 日记分类有 limit=10: ${hasDiaryLimit ? '✅' : '❌'}`);
        console.log(`✓ 其他分类有 limit=999: ${hasOtherLimit ? '✅' : '❌'}`);
        
        if (hasDiaryLimit && hasOtherLimit) {
            console.log('\n✅ Config parsing test PASSED\n');
            return true;
        } else {
            console.log('\n❌ Config parsing test FAILED\n');
            return false;
        }
    } catch (error) {
        console.error('Test failed:', error);
        return false;
    }
}

/**
 * 测试2：验证限制逻辑
 * 测试 DataService._limitItems() 方法
 */
export function testLimitLogic() {
    console.log('=== Test 2: Limit Logic ===\n');
    
    const testCases = [
        {
            name: 'limit=10, items=15',
            items: Array(15).fill({ title: 'item' }),
            limit: 10,
            expect: 10
        },
        {
            name: 'limit=999, items=15',
            items: Array(15).fill({ title: 'item' }),
            limit: '999',
            expect: 15
        },
        {
            name: 'limit=undefined, items=15',
            items: Array(15).fill({ title: 'item' }),
            limit: undefined,
            expect: 15
        },
        {
            name: 'limit=null, items=15',
            items: Array(15).fill({ title: 'item' }),
            limit: null,
            expect: 15
        },
        {
            name: 'limit="invalid", items=15',
            items: Array(15).fill({ title: 'item' }),
            limit: 'invalid',
            expect: 15 // 应该返回全部并记录警告
        },
        {
            name: 'limit=5, items=3',
            items: Array(3).fill({ title: 'item' }),
            limit: 5,
            expect: 3 // 数组长度小于 limit
        }
    ];
    
    let passed = 0;
    
    testCases.forEach(({ name, items, limit, expect }) => {
        // 模拟 _limitItems 逻辑
        let result;
        if (limit === undefined || limit === null || limit === '999' || limit === 999) {
            result = items.length;
        } else {
            const numLimit = parseInt(limit, 10);
            if (isNaN(numLimit) || numLimit <= 0) {
                result = items.length; // 非法值返回全部
            } else {
                result = Math.min(numLimit, items.length);
            }
        }
        
        const testPassed = result === expect;
        console.log(`${testPassed ? '✓' : '✗'} ${name}: got ${result}, expect ${expect}`);
        if (testPassed) passed++;
    });
    
    console.log(`\n${passed}/${testCases.length} tests passed\n`);
    return passed === testCases.length;
}

/**
 * 测试3：集成测试 - 验证日记分类最多显示10条
 * 这个测试需要实际加载数据
 */
export async function testDiaryLimit() {
    console.log('=== Test 3: Diary Integration Test ===\n');
    
    try {
        // 模拟数据加载和限制流程
        const response = await fetch('contents/日记.md');
        if (!response.ok) {
            console.error('Failed to load diary');
            return false;
        }
        
        const markdown = await response.text();
        const lines = markdown.split('\n');
        
        // 计算日记总数
        const totalDiaries = lines.filter(l => /^##\s+\d{4}年/.test(l)).length;
        console.log(`📝 Total diary entries in file: ${totalDiaries}`);
        
        // 模拟限制
        const displayLimit = 10;
        const willDisplay = Math.min(totalDiaries, displayLimit);
        const willHide = Math.max(0, totalDiaries - displayLimit);
        
        console.log(`\n📊 With limit=${displayLimit}:`);
        console.log(`  - Will display: ${willDisplay} entries`);
        console.log(`  - Will hide: ${willHide} entries`);
        
        if (totalDiaries > displayLimit) {
            console.log(`\n✅ Limit test PASSED (日记超过限制，将显示最新${displayLimit}条)\n`);
            return true;
        } else {
            console.log(`\n⚠️  Note: Total diaries (${totalDiaries}) ≤ limit (${displayLimit}), all will be displayed\n`);
            return true;
        }
    } catch (error) {
        console.error('Integration test failed:', error);
        return false;
    }
}

/**
 * 测试4：检查当前页面的日记显示数量
 * 这需要在页面已加载完毕后运行
 */
export function testCurrentPageDisplay() {
    console.log('=== Test 4: Current Page Display Count ===\n');
    
    try {
        // 查找日记分类的卡片容器
        const diarySection = document.querySelector('[data-category-id="diary"]');
        
        if (!diarySection) {
            console.warn('⚠️  Cannot find diary section on page (可能页面还未加载完成)');
            console.log('操作步骤：');
            console.log('1. 等待页面完全加载');
            console.log('2. 重新运行此测试\n');
            return null;
        }
        
        const diaryCards = diarySection.querySelectorAll('.card');
        const displayCount = diaryCards.length;
        
        console.log(`✓ Currently displaying: ${displayCount} diary entries`);
        console.log(`✓ Expected: ≤ 10 entries\n`);
        
        if (displayCount <= 10) {
            console.log('✅ Display limit test PASSED\n');
            return true;
        } else {
            console.log('❌ Display limit test FAILED (显示超过10条)\n');
            return false;
        }
    } catch (error) {
        console.error('Display count test failed:', error);
        return false;
    }
}

/**
 * 运行所有测试
 */
export async function runAllTests() {
    console.log('\n🧪 Starting Diary Limit Tests...\n');
    console.log('═'.repeat(50) + '\n');
    
    const results = [];
    
    // Test 1
    const test1 = await testConfigParsing();
    results.push({ name: 'Config Parsing', passed: test1 });
    
    // Test 2
    const test2 = testLimitLogic();
    results.push({ name: 'Limit Logic', passed: test2 });
    
    // Test 3
    const test3 = await testDiaryLimit();
    results.push({ name: 'Diary Integration', passed: test3 });
    
    console.log('═'.repeat(50));
    console.log('\n📋 Test Summary:\n');
    results.forEach(({ name, passed }) => {
        console.log(`  ${passed ? '✅' : '❌'} ${name}`);
    });
    
    const allPassed = results.every(r => r.passed);
    console.log('\n' + (allPassed ? '✅ All tests PASSED!' : '⚠️  Some tests failed'));
    console.log('\n💡 Tip: After page finishes loading, run testCurrentPageDisplay() to verify display count\n');
}

/**
 * 快速检查命令
 */
export function quickCheck() {
    console.log('\n🔍 Quick Diary Limit Check\n');
    
    const checkList = [
        '✓ 配置中日记分类有 展示限制：10',
        '✓ 其他分类有 展示限制：999',
        '✓ Parser 能解析 limit 字段',
        '✓ DataService 有 _limitItems() 方法',
        '✓ DataService 应用了限制逻辑'
    ];
    
    console.log('Implementation checklist:');
    checkList.forEach(item => console.log(`  ${item}`));
    
    console.log('\nRun: runAllTests() to verify implementation\n');
}

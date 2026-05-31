/**
 * 日期排序功能测试脚本
 * 用于验证整个实现流程
 * 
 * 使用：在浏览器控制台运行 (F12 -> Console)
 * import * as Test from './test-date-sorting.js'
 * Test.runAllTests()
 */

import { DateUtils } from '../core/date-utils.js';
import { SortStrategyFactory } from '../core/sort-strategy.js';

/**
 * 测试 DateUtils 模块
 */
function testDateUtils() {
    console.log('=== Testing DateUtils ===');
    
    const testCases = [
        { input: '2026年1月6日', expect: true },
        { input: '2026年3月29日', expect: true },
        { input: '2026年12月31日', expect: true },
        { input: '2026年2月29日', expect: false }, // 无效：2026年非闰年
        { input: 'Invalid Date', expect: false },
        { input: '', expect: false }
    ];

    console.log('\n1. Testing extractDateFromTitle():');
    testCases.forEach(({ input, expect }) => {
        const result = DateUtils.extractDateFromTitle(input);
        const passed = (result !== null) === expect;
        console.log(`  ${passed ? '✓' : '✗'} "${input}" -> ${result ? `Date(${result.toLocaleDateString('zh-CN')})` : 'null'}`);
    });

    console.log('\n2. Testing isDateFormatTitle():');
    const formatCases = [
        { input: '2026年1月6日', expect: true },
        { input: 'not a date', expect: false }
    ];
    formatCases.forEach(({ input, expect }) => {
        const result = DateUtils.isDateFormatTitle(input);
        const passed = result === expect;
        console.log(`  ${passed ? '✓' : '✗'} "${input}" -> ${result}`);
    });

    console.log('\n3. Testing formatDateToString():');
    const date = new Date(2026, 0, 6); // 2026年1月6日
    const formatted = DateUtils.formatDateToString(date);
    console.log(`  Formatted: ${formatted} (expected: 2026年1月6日)`);
}

/**
 * 测试排序策略
 */
function testSortStrategy() {
    console.log('\n=== Testing SortStrategyFactory ===');

    // 构造测试数据
    const diaryItems = [
        {
            title: '2026年1月6日',
            dateTimestamp: new Date(2026, 0, 6).getTime(),
            content: 'First entry'
        },
        {
            title: '2026年3月29日',
            dateTimestamp: new Date(2026, 2, 29).getTime(),
            content: 'Third entry'
        },
        {
            title: '2026年1月12日',
            dateTimestamp: new Date(2026, 0, 12).getTime(),
            content: 'Second entry'
        }
    ];

    console.log('\n1. Testing diary sort (date descending):');
    console.log('  Before sort:');
    diaryItems.forEach((item, i) => {
        console.log(`    ${i}. ${item.title}`);
    });

    const sortedDiary = [...diaryItems];
    SortStrategyFactory.sortItems(sortedDiary, 'diary');
    
    console.log('  After sort (should be newest first):');
    sortedDiary.forEach((item, i) => {
        console.log(`    ${i}. ${item.title}`);
    });

    const isCorrect = sortedDiary[0].title === '2026年3月29日' &&
                      sortedDiary[1].title === '2026年1月12日' &&
                      sortedDiary[2].title === '2026年1月6日';
    console.log(`  Result: ${isCorrect ? '✓ Correct order' : '✗ Wrong order'}`);

    // 测试序号排序
    const otherItems = [
        { title: 'Item 1', order: 3 },
        { title: 'Item 2', order: 1 },
        { title: 'Item 3', order: 2 }
    ];

    console.log('\n2. Testing default sort (by order field):');
    console.log('  Before sort:');
    otherItems.forEach((item, i) => {
        console.log(`    ${i}. ${item.title} (order: ${item.order})`);
    });

    const sortedDefault = [...otherItems];
    SortStrategyFactory.sortItems(sortedDefault, 'default');

    console.log('  After sort (should be by order: 1, 2, 3):');
    sortedDefault.forEach((item, i) => {
        console.log(`    ${i}. ${item.title} (order: ${item.order})`);
    });

    const isOrderCorrect = sortedDefault[0].order === 1 &&
                          sortedDefault[1].order === 2 &&
                          sortedDefault[2].order === 3;
    console.log(`  Result: ${isOrderCorrect ? '✓ Correct order' : '✗ Wrong order'}`);
}

/**
 * 综合集成测试
 */
async function testIntegration() {
    console.log('\n=== Integration Test ===');
    
    try {
        // 测试从实际的日记文件加载和排序
        const response = await fetch('contents/日记.md');
        if (!response.ok) {
            console.error('Failed to load 日记.md');
            return;
        }

        const markdown = await response.text();
        
        // 简单检查文件内容
        const lines = markdown.split('\n');
        const headerCount = lines.filter(l => /^##\s+/.test(l)).length;
        
        console.log(`\n✓ Successfully loaded 日记.md`);
        console.log(`  Found ${headerCount} diary entries`);
        console.log(`  First 500 chars: ${markdown.substring(0, 500)}...`);
    } catch (error) {
        console.error('Integration test failed:', error);
    }
}

/**
 * 运行所有测试
 */
export async function runAllTests() {
    console.log('🧪 Starting Date Sorting Tests...\n');
    
    testDateUtils();
    testSortStrategy();
    await testIntegration();
    
    console.log('\n✅ All tests completed! Check results above.');
    console.log('\nNext: Open browser DevTools to see sorted diary entries.');
}

/**
 * 快速检查（显示当前排序状态）
 */
export async function quickCheck() {
    console.log('\n🔍 Quick Check - Current Diary Sort Order:');
    try {
        const response = await fetch('contents/日记.md');
        const markdown = await response.text();
        
        const lines = markdown.split('\n');
        const entries = [];
        
        lines.forEach(line => {
            if (/^##\s+/.test(line)) {
                const title = line.replace(/^##\s+/, '').trim();
                const dateObj = DateUtils.extractDateFromTitle(title);
                entries.push({
                    title,
                    date: dateObj,
                    timestamp: dateObj ? dateObj.getTime() : 0
                });
            }
        });

        entries.sort((a, b) => b.timestamp - a.timestamp);
        
        console.log('Sorted diary entries (newest first):');
        entries.forEach((entry, i) => {
            console.log(`  ${i + 1}. ${entry.title}`);
        });
    } catch (error) {
        console.error('Quick check failed:', error);
    }
}

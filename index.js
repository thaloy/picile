/**
 * @file 使用puppeteer抓取百度图片搜索到的图片链接
 * @author thalo
 * @type node script
 */

const fs = require('fs');
const readline = require('readline');
const puppeteer = require('puppeteer');

// 百度图片的搜索地址，其中word是其关键字.
const baiduImgUrl = 'https://image.baidu.com/search/index?tn=baiduimage&ct=201326592&lm=-1&cl=2&word=${}&fr=ala&ala=1&alatpl=adress&pos=0&hs=2&xthttps=111111';

// readline的接口，其中输入和输出是标准输入/输出.
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

/**
 * @function 对rl.question封装，返回promise
 * @param {object} context - 上下文
 * @param {string} methodStr - 方法名	
 * @return function
 */
function encapsulationQuestion(context, str) {
	return function(question) {
		return new Promise((resolve, reject) => {
			context[str](question, answer => resolve(answer));
		});
	};	
}

const questionInstance = encapsulationQuestion(rl, 'question');

// 因为使用了async/await,所以我们要在这里IFF包装一下.
(async () => {

	const keyword = await questionInstance('关键字\n');
	const imgNum = await questionInstance('数量\n');
	const filePath = await questionInstance('图片存储的地址\n');

	// puppeteer.launch可以开启一个chromium浏览器,
	const browser = await puppeteer.launch();
	
	// 打开一个新的tab页面
	const page = await browser.newPage();

	// 这个新的页面跳转到下面的连接。
	await page.goto(baiduImgUrl.replace('${}', keyword), { waitUntil: 'load' });
	
	// 判断页面的图片是不是渲染完成的函数
	// 因为页面具有上拉加载
	// 这个方法是为了检测上拉加载出来的图片渲染完成
	function renderPartFrameFinish() {
		const imgs = document.getElementsByClassName('main_img');

		const renderFinish = Array.from(imgs).every(img => img.complete);

		return renderFinish;
	}
	
	// 上拉加载的图片在dom中被插入完成.
	function imgDomLoaded() {
		const imgs = document.getElementsByClassName('main_img');
		
		return !(window.len === imgs.length);
	}
	
	/**
	 * @desc 
	 * step1: 等待页面的图片都渲染完.
	 * step2: 调用浏览器api让页面自动滚动到下一帧.
	 * step3:	等待新加载的img dom插入到document内时才可以进行下一次的滚动.
	 */
	async function pageScroll() {
		await page.waitForFunction(renderPartFrameFinish, { polling: 400 });
		await page.evaluate(() => {
			window.len = document.getElementsByClassName('main_img').length;
			window.scrollTo(0, document.documentElement.offsetHeight);
		});
		await page.waitForFunction(imgDomLoaded, { polling: 400 });
	}

	// 获得加载出的图片的数量
	async function getImgNumber() {
		return await page.$$eval('.main_img', els => els.length);	
	}

	let loadedImgCount = 0;
	while(imgNum > loadedImgCount) {
		await pageScroll();
		loadedImgCount = await getImgNumber();		
	}

	// 在浏览器环境下找到选择器为.main_img的dom结构，并且将对其操作的结构返回给node环境.
	const imgs = (await page.$$eval('.main_img', els => Array.from(els).map(el => el.getAttribute('data-imgurl'))))
		.splice(0, imgNum);
	
	// 将数据写入到文件中，以ES6的模块化方式存储.
	const ws = fs.createWriteStream(filePath);
	ws.on('finish', () => process.exit());
	ws.write('export default [\n');
	imgs.forEach(imgUrl => ws.write(`  '${imgUrl}',\n`));
	ws.write(']');
	ws.end();

})();

// src/gameScene.js
import { GameEvents } from './events.js';
import { GameData } from './data.js';

import { HexTile, TERRAIN_TYPES, HEX_SIZE } from './HexTile.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });

        this.tileMap = new Map(); // (q, r) 키 기반 타일 인스턴스 저장소
    }

    create() {
        // UI 씬 병렬 실행
        this.scene.run('UIScene');

        // ESC 키 등록
        this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

        // --------------------------------------------------
        // Scene 라이프사이클 이벤트 및 커스텀 이벤트 처리
        // --------------------------------------------------

        // 1. UIScene에서 '재개' 요청을 보냈을 때 수신
        const uiScene = this.scene.get('UIScene');
        uiScene.events.on(GameEvents.GAME_RESUMED, this.resumeGame, this);

        // 2. GameScene 자체 일시정지 이벤트 콜백
        this.events.on('pause', () => {
            console.log('GameScene 일시 정지됨');
            // 물리 엔진 정지 (필요 시)
            this.physics.pause();
        });

        // 3. GameScene 자체 재개 이벤트 콜백
        this.events.on('resume', () => {
            console.log('GameScene 재개됨');
            // 물리 엔진 재개
            this.physics.resume();
        });

        this.events.on('tileClicked', (tile) => {

            //console.log(`(${tile.q}, ${tile.r}) | 지형: ${tile.terrain.name}`);
            this.mapGrid[tile.r][tile.q] = tile.terrain.id; // 클릭된 타일의 지형 ID를 맵 데이터에 반영
            this.saveMapGrid(); // 타일 클릭 시마다 맵 데이터 저장
        });

        // 씬 종료 시 이벤트 해제
        this.events.once('shutdown', () => {
            uiScene.events.off(GameEvents.GAME_RESUMED, this.resumeGame, this);
        });
        //////////////////
        // 1. 2D 맵 지형 데이터 정의 (코드/JSON/랜덤 생성 가능)
        // 0: 초원, 1: 산, 2: 강, 3: 도로, 4: 건물
        
        

        
        this.mapGrid = [
            [0, 3, 3, 1, 3, 3, 3, 3],
            [0, 3, 1, 3, 3, 3, 3, 3],
            [3, 3, 1, 3, 3, 3, 3, 0],
            [3, 3, 1, 2, 2, 3, 0, 0],
            [3, 3, 3, 2, 2, 3, 0, 0],
            [0, 3, 3, 3, 3, 0, 0, 0]
        ];
        GameData.load();
        if(GameData.saveData.mapGrid && GameData.saveData.mapGrid.length > 0){
            this.mapGrid = GameData.saveData.mapGrid;
        }else{
            this.saveMapGrid();
        }
         //console.log('GameScene에서 불러온 게임 데이터:', GameData);

        // 2. 맵 데이터 바탕으로 인스턴스 배치
        this.generateHexMapFromGrid(this.mapGrid);

        // 3. 카메라 드래그 이동 설정
        this.setupCameraControls();

        // 4. 임시 브러시 버튼 생성
        this.generateBrush();
    }
    //임시
    saveMapGrid(){
        GameData.saveData.mapGrid = this.mapGrid;
        GameData.save();
        //console.log('맵 데이터 저장 완료:', GameData.mapGrid);
    }
    mapNumber = 0;//
    generateBrush(){
        const uiScene = this.scene.get('UIScene');
        const buttonbox = uiScene.add.rectangle(80, 50, 120, 40, 0x222222, 0.95)
            .setStrokeStyle(2, 0xffffff)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                //console.log('Brush button clicked!');
                this.mapNumber = (this.mapNumber + 1) % 5; // 0~4 반복

                this.brushName();
                // 브러시 모드 활성화 로직 추가
            });

        const buttonText = uiScene.add.text(80, 50, 'Brush', { fontSize: '20px', fill: '#fff' })
            .setOrigin(0.5)
       
        this.brushName = function() {
            const terrainType = Object.values(TERRAIN_TYPES).find(t => t.id === this.mapNumber) || TERRAIN_TYPES.EMPTY;
            buttonText.setText(`Brush: ${terrainType.name}`);
        };
        this.brushName();

        const mapExtensionButton = uiScene.add.rectangle(80, 180, 40, 40, 0x222222, 0.95)
            .setStrokeStyle(2, 0xffffff)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                // 맵 확장 로직
                this.extendMap();
            });
        this.extendMap = function() {
            const newRow = new Array(this.mapGrid[0].length).fill(0); // 새로운 행 생성 (초원으로 초기화)
            this.mapGrid.push(newRow); // 맵 데이터에 새로운 행 추가
            this.saveMapGrid(); // 변경된 맵 데이터 저장
            this.clearHexMap();
            this.generateHexMapFromGrid(this.mapGrid); // 새로운 맵 데이터로 타일 재생성
        }


        const mapUnextensionButton = uiScene.add.rectangle(80, 100, 40, 40, 0x222222, 0.95)
            .setStrokeStyle(2, 0xffffff)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                // 맵 축소 로직
                this.reduceMap();
            });
        
        this.reduceMap = function() {
            if (this.mapGrid.length > 1) { // 최소 1행은 남겨둠
                this.mapGrid.pop(); // 마지막 행 제거
                this.saveMapGrid(); // 변경된 맵 데이터 저장
                this.clearHexMap();
                this.generateHexMapFromGrid(this.mapGrid); // 새로운 맵 데이터로 타일 재생성
            }
        }

        const mapLengthExtensionButton = uiScene.add.rectangle(120, 140, 40, 40, 0x222222, 0.95)
            .setStrokeStyle(2, 0xffffff)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                // 맵 길이 확장 로직
                this.extendMapLength();
            });
        this.extendMapLength = function() {
            for (let i = 0; i < this.mapGrid.length; i++) {
                this.mapGrid[i].push(0); // 각 행에 새로운 열 추가 (초원으로 초기화)
            }
            this.saveMapGrid(); // 변경된 맵 데이터 저장
            this.clearHexMap();
            this.generateHexMapFromGrid(this.mapGrid); // 새로운 맵 데이터로 타일 재생성
        }

        const mapLengthUnextensionButton = uiScene.add.rectangle(40, 140, 40, 40, 0x222222, 0.95)
            .setStrokeStyle(2, 0xffffff)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                // 맵 길이 축소 로직
                this.reduceMapLength();
            });
        
        this.reduceMapLength = function() {
            if (this.mapGrid[0].length > 1) { // 최소 1열은 남겨둠
                for (let i = 0; i < this.mapGrid.length; i++) {
                    this.mapGrid[i].pop(); // 각 행에서 마지막 열 제거
                }
                this.saveMapGrid(); // 변경된 맵 데이터 저장
                this.clearHexMap();
                this.generateHexMapFromGrid(this.mapGrid); // 새로운 맵 데이터로 타일 재생성
            }
        }
    }

    

    // Axial 좌표 (q, r) -> 화면 픽셀 좌표 (x, y) 변환식
    axialToPixel(q, r) {
        const x = HEX_SIZE * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
        const y = HEX_SIZE * (3 / 2 * r);
        return { x, y };
    }
    clearHexMap(){
        // 기존 타일 인스턴스 제거
        this.tileMap.forEach(tile => {
            tile.destroy();
        });
        this.tileMap.clear();
    }
    generateHexMapFromGrid(grid) {
        const startX = 200; // 맵 시작 X 오프셋
        const startY = 150; // 맵 시작 Y 오프셋

        for (let r = 0; r < grid.length; r++) { // 행(Row)
            for (let q = 0; q < grid[r].length; q++) { // 열(Column)
                const terrainId = grid[r][q];
                
                // 지형 객체 매핑
                const terrainType = Object.values(TERRAIN_TYPES).find(t => t.id === terrainId) || TERRAIN_TYPES.EMPTY;

                // 화면 위치 계산
                const pos = this.axialToPixel(q, r);
                const posX = startX + pos.x;
                const posY = startY + pos.y;

                // 🔥 HexTile 인스턴스 생성!
                const tileInstance = new HexTile(this, posX, posY, q, r, terrainType);

                // Map에 인스턴스 저장 (q, r 키 사용)
                this.tileMap.set(`${q},${r}`, tileInstance);
            }
        }
    }

    setupCameraControls() {
        // 마우스 드래그로 탐험
        this.input.on('pointermove', (pointer) => {
            if (pointer.isDown) {
                this.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x);
                this.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y);
            }
        });
    }

    update() {
        // ESC 키 입력 시 일시정지 토글
        if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
            this.pauseGame();
        }
    }

    pauseGame() {
        if (!this.scene.isPaused('GameScene')) {
            // 1. GameScene 일시정지 (update, physics, tweens 동작 멈춤)
            this.scene.pause('GameScene');

            // 2. UIScene에 일시정지 상태 전달 (메뉴 팝업 띄우기)
            this.events.emit(GameEvents.TOGGLE_PAUSE, true);
        }
    }

    resumeGame() {
        if (this.scene.isPaused('GameScene')) {
            // 1. GameScene 재개
            this.scene.resume('GameScene');

            // 2. UIScene에 재개 상태 전달 (메뉴 팝업 닫기)
            this.events.emit(GameEvents.TOGGLE_PAUSE, false);
        }
    }
}
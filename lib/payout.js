// 파리뮤추얼(자동배당) 방식 정산 유틸
// 같은 마켓에 걸린 전체 판돈(승/패 양쪽 다)을 모아서,
// 적중한 사람들에게 "본인이 배팅한 금액 비율"대로 나눠줍니다.
// 100포인트 미만 단위는 내림 처리합니다.
//
// 예) A팀에 1000+1000+3000=5000P, B팀에 2000+1000+3000=6000P 배팅, 총 11000P
//     A팀이 이기면: 11000P를 A팀 배팅자 3명이 각자 배팅액(1000/1000/3000) 비율로 나눠 가짐
//       - 1000P 배팅자: 11000 * (1000/5000) = 2200P
//       - 1000P 배팅자: 11000 * (1000/5000) = 2200P
//       - 3000P 배팅자: 11000 * (3000/5000) = 6600P
//     (적중자가 아무도 없으면 아무도 못 받고, 판돈은 그대로 소멸)

export function floorTo100(n) {
  return Math.floor(n / 100) * 100;
}

/**
 * @param {Array<{id, points_bet, choice}>} bets - 같은 마켓(market)에 속한 배팅 전체
 * @param {string} winningChoice - 정산 결과 (예: 'A', 'UP' 등). null이면 전원 환불(PUSH).
 * @returns {Array<{id, won, points_won}>}
 */
export function computePariMutuelPayouts(bets, winningChoice) {
  if (!winningChoice) {
    return bets.map((b) => ({ id: b.id, won: null, points_won: b.points_bet }));
  }

  const totalPool = bets.reduce((sum, b) => sum + b.points_bet, 0);
  const winningBets = bets.filter((b) => b.choice === winningChoice);
  const totalWinningStake = winningBets.reduce((sum, b) => sum + b.points_bet, 0);

  return bets.map((b) => {
    const won = b.choice === winningChoice;
    if (!won || totalWinningStake === 0) {
      return { id: b.id, won: false, points_won: 0 };
    }
    // ✅ 5% 수수료 공제
    const share = totalPool * (b.points_bet / totalWinningStake);
    const shareAfterFee = share * 0.95; // 5% 수수료 제외
    return { id: b.id, won: true, points_won: floorTo100(shareAfterFee) };
  });
}

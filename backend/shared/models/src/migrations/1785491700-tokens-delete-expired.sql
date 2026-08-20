DELETE FROM `tokens` WHERE `accessTokenValidUntil` < NOW() AND `refreshTokenValidUntil` < NOW();

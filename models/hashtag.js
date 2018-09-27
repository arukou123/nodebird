/*jshint esversion: 6 */

module.exports = (sequelize, DataTypes) => (       //나중에 검색하기 위해 해시태그 모델을 따로 뒀음
		sequelize.define('hashtag', {
			title: {
				type: DataTypes.STRING(15),
				allowNull: false,
				unique: true,
			},
		}, {
			timestamps: true,     //createdAt, updatedAt 컬럼 추가
			paranoid: true,		  //deletedAt 컬럼 추가
		})		
);


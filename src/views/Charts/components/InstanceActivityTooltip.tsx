

type Props = {
    color?: any;
    displayName?: any;
    icon?: any;
    joinTime?: any;
    leaveTime?: any;
    duration?: any;
};const InstanceActivityTooltip = ({ color, displayName, icon, joinTime, leaveTime, duration }: Props) => {
    return (




        <div style={{ display: 'flex', alignItems: 'center' }}>




            <div
                style={{
                    width: '10px',
                    height: '55px',
                    backgroundColor: color,
                    marginRight: '6px'
                }}
            />




            <div>




                <div>
                    {displayName} {icon}




                </div>




                <div>
                    {joinTime} - {leaveTime}




                </div>




                <div>{duration}</div>




            </div>




        </div>
    );
};

export default InstanceActivityTooltip;

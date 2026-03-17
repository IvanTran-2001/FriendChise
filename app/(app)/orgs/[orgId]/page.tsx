const Page = async ({ params }: { params: Promise<{ orgId: string }> }) => {
  const { orgId } = await params;
  return (
    <div>org id: {orgId}</div>
  )
}

export default Page